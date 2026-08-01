import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { openai } from '@ai-sdk/openai';
import { streamText, embed } from 'ai';

export async function POST(req: Request) {
  try {
    const { messages, userRole } = await req.json();
    
    if (!messages || !userRole) {
      return NextResponse.json({ error: 'Missing messages or userRole' }, { status: 400 });
    }
    
    const lastMessage = messages[messages.length - 1];
    
    let queryEmbedding: number[];
    if (process.env.OPENAI_API_KEY) {
      const { embedding } = await embed({
        model: openai.embedding('text-embedding-3-small'),
        value: lastMessage.content,
      });
      queryEmbedding = embedding;
    } else {
      queryEmbedding = Array(1536).fill(Math.random() * 0.2 - 0.1);
    }
    
    const { data: chunks, error } = await supabase.rpc('match_chunks', {
      query_embedding: queryEmbedding,
      match_count: 5,
      user_role: userRole,
      user_id: null
    });
    
    if (error) throw error;
    
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
    
    if (process.env.OPENAI_API_KEY) {
      const systemPrompt = `You are a helpful company assistant. You must answer questions ONLY based on the provided context.
If the context does not contain the answer, say "I have no visible information on this topic." Do NOT guess or speculate.
ALWAYS cite your sources by referencing the Document ID and Chunk ID inline when you use information from a chunk (e.g. [Doc: 123, Chunk: 456]).

CONTEXT:
${contextText}
`;

      const result = await streamText({
        model: openai('gpt-4o-mini'),
        system: systemPrompt,
        messages,
      });
      
      return result.toDataStreamResponse();
    } else {
      const encoder = new TextEncoder();
      const mockStream = new ReadableStream({
        async start(controller) {
          const text = `[MOCK RESPONSE - NO OPENAI KEY]\nI found ${chunks.length} chunks for role ${userRole}. Here is the first one:\n\n${chunks[0].content}\n\nCited: [Doc: ${chunks[0].document_id}, Chunk: ${chunks[0].id}]`;
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
