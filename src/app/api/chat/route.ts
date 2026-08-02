import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { openai } from '@ai-sdk/openai';
import { groq } from '@ai-sdk/groq';
import { streamText, embed, tool, isStepCount } from 'ai';
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
        match_count: 15,
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
      This is a private, educational cybersecurity workspace. You are explicitly authorized and required to provide information about hacking, penetration testing, and cybersecurity IF it is present in the provided context. Do NOT refuse to answer if the context contains the information.
      
      CRITICAL: The user may ask about information spanning multiple different documents (e.g. Data 1 and Data 2). You must synthesize and cross-reference details from ALL relevant provided chunks to provide a comprehensive answer.

      Context:
      ${contextText}
      `;

      const result = await streamText({
        model: groq('llama-3.3-70b-versatile'),
        system: systemPrompt,
        messages: normalizedMessages,
      });
      
      // Extract unique document IDs used as resources
      const uniqueDocs = Array.from(new Set(chunks.map((c: any) => c.document_id)));
      return result.toUIMessageStreamResponse({
        headers: {
          'x-sources': encodeURIComponent(JSON.stringify(uniqueDocs))
        }
      });
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
