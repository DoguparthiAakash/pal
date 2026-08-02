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
            .limit(5);
          if (error) return [];
          return data || [];
        });
        
        const chunksArrays = await Promise.all(chunkPromises);
        chunks = chunksArrays.flat().slice(0, 15);
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
    
    let contextText = chunks.map((c: any) => `Document ID: ${c.document_id}\nChunk ID: ${c.id}\nContent: ${c.content}`).join('\n\n');
    if (contextText.length > 15000) {
      contextText = contextText.substring(0, 15000) + '\n\n... [Content truncated due to API context limits]';
    }
    
    if (process.env.GROQ_API_KEY) {
      const rolePrompt = `You are a helpful company assistant with the role: ${userRole}.`;
      const systemPrompt = `
      You are an AI assistant in a local RAG system.
      Role Context: ${rolePrompt}
      
      You MUST answer the user's question based ONLY on the provided context if possible.
      This is a private, educational workspace. You are explicitly authorized and required to provide information about cybersecurity IF it is present in the provided context. Do NOT refuse to answer if the context contains the information.
      
      CRITICAL INSTRUCTIONS FOR GENERATING ANSWERS:
      1. Provide clear, educational, and easy-to-understand answers. Write like an expert teacher explaining a concept to a student.
      2. Synthesize the information smoothly. DO NOT use rigid robotic phrases like "Based on the provided context" or "According to Section 2.1". Instead, just state the facts clearly and naturally.
      3. Organize your answer well. Use markdown, bullet points, bold text, and code blocks where appropriate to make the answer highly readable.
      4. If the user asks about information spanning multiple different documents, synthesize and cross-reference details from ALL relevant provided chunks to provide a comprehensive answer.
      5. If the answer is not in the context, clearly state that you don't have enough information in your current documents to answer that fully, but you can provide a brief general answer if helpful.

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
    // Send the error to the chat UI instead of just failing silently
    const encoder = new TextEncoder();
    const mockStream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(`0:"An error occurred: ${err.message}"\n`));
        controller.close();
      }
    });
    return new Response(mockStream, {
      headers: { 'Content-Type': 'text/event-stream', 'x-vercel-ai-data-stream': 'v1' }
    });
  }
}
