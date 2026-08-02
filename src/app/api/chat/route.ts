import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { openai } from '@ai-sdk/openai';
import { groq } from '@ai-sdk/groq';
import { streamText, embed, tool, isStepCount } from 'ai';
import { search } from 'duck-duck-scrape';
import { z } from 'zod';

export async function POST(req: Request) {
  try {
    const { messages, userRole, notebookId } = await req.json();
    
    if (!messages || !userRole || !notebookId) {
      return NextResponse.json({ error: 'Missing messages, userRole, or notebookId' }, { status: 400 });
    }
    
    // Normalize messages from UI format (parts) to CoreMessage format (content)
    const normalizedMessages = messages.map((m: any) => ({
      ...m,
      content: typeof m.content === 'string' ? m.content : (m.parts ? m.parts.map((p: any) => p.text || '').join('') : '')
    }));
    
    const lastMessage = normalizedMessages[normalizedMessages.length - 1];
    
    let chunks;
    if (process.env.OPENAI_API_KEY) {
      const { embedding } = await embed({
        model: openai.embedding('text-embedding-3-small'),
        value: lastMessage.content,
      });
      const { data, error } = await supabase.rpc('match_chunks_in_notebook', {
        query_embedding: embedding,
        match_count: 5,
        user_role: userRole,
        user_id: null,
        p_notebook_id: notebookId
      });
      if (error) throw error;
      chunks = data;
    } else {
      // Fallback: Fetch chunks directly for the notebook if no OpenAI key
      const { data: nds, error: ndError } = await supabase
        .from('notebook_documents')
        .select('document_id')
        .eq('notebook_id', notebookId);
      
      if (ndError) throw ndError;
      
      if (!nds || nds.length === 0) {
        chunks = [];
      } else {
        const docIds = nds.map((nd: any) => nd.document_id);
        
        // Fetch up to 10 chunks per document to avoid starvation of recently linked sources
        const chunkPromises = docIds.map(async (docId: string) => {
          const { data, error } = await supabase
            .from('chunks')
            .select('id, document_id, content')
            .eq('document_id', docId)
            .contains('allowed_roles', [userRole])
            .limit(15);
          if (error) return [];
          return data;
        });
        
        const chunksArrays = await Promise.all(chunkPromises);
        chunks = chunksArrays.flat();
      }
    }
    
    if (!chunks || chunks.length === 0) {
      const encoder = new TextEncoder();
      const mockStream = new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode(`0:"I have no visible information on this topic."\n`));
          controller.close();
        }
      });
      return new Response(mockStream, {
        headers: { 'Content-Type': 'text/event-stream', 'x-vercel-ai-data-stream': 'v1' }
      });
    }
    
    const contextText = chunks.map((c: any) => `Document ID: ${c.document_id}\nChunk ID: ${c.id}\nContent: ${c.content}`).join('\n\n');
    
    if (process.env.GROQ_API_KEY) {
      const rolePrompt = `You are a helpful company assistant with the role: ${userRole}.`;
      const systemPrompt = `
      You are an AI assistant in a local RAG system.
      Role Context: ${rolePrompt}
      
      You MUST answer the user's question based ONLY on the provided context if possible.
      If the context does not contain the answer, you may use the searchWeb tool to find it.
      IMPORTANT: IF THE USER REQUEST IS ILLEGAL, MALICIOUS, OR AGAINST SAFETY GUIDELINES (e.g. hacking, violence), DO NOT USE ANY TOOLS. Simply reply with a polite refusal text.
      
      Context:
      ${contextText}
      `;

      const result = await streamText({
        model: groq('llama-3.3-70b-versatile'),
        system: systemPrompt,
        messages: normalizedMessages,
        stopWhen: isStepCount(5),
        tools: {
          searchWeb: tool({
            description: 'Search the web for up-to-date information. DO NOT USE THIS TOOL IF THE USER ASKS ABOUT HACKING OR ILLEGAL ACTIVITIES.',
            inputSchema: z.object({ query: z.string() }),
            execute: async ({ query }: { query: string }) => {
              try {
                const results = await search(query);
                return results.results.slice(0, 3).map(r => r.title + '\n' + r.description).join('\n\n');
              } catch (e) {
                return "Search failed or rate limited.";
              }
            }
          })
        }
      });
      
      return result.toUIMessageStreamResponse();
    } else {
      const encoder = new TextEncoder();
      const mockStream = new ReadableStream({
        async start(controller) {
          const text = `[MOCK RESPONSE - NO GROQ KEY]\nI found ${chunks.length} chunks for role ${userRole}. Here is the first one:\n\n${chunks[0].content}\n\nCited: [Doc: ${chunks[0].document_id}, Chunk: ${chunks[0].id}]`;
          const parts = text.split(' ');
          for (const word of parts) {
            controller.enqueue(encoder.encode(`0:"${word} "\n`));
            await new Promise(r => setTimeout(r, 20));
          }
          controller.close();
        }
      });
      return new Response(mockStream, {
        headers: { 'Content-Type': 'text/event-stream', 'x-vercel-ai-data-stream': 'v1' }
      });
    }

  } catch (err: any) {
    console.error('Chat error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
