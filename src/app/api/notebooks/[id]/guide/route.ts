import { NextResponse } from 'next/server';
import { createServerClient } from '@/infrastructure/auth/server';
import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { config } from '@/config';
import { z } from 'zod';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const { userRole, offset = 0 } = await req.json();
    
    if (!userRole) {
      return NextResponse.json({ error: 'Missing userRole' }, { status: 400 });
    }
    
    // We need to fetch all chunks in this notebook that the user has access to.
    // We can do this by using a SQL query directly (or via a new RPC, or by getting notebook_documents and then querying chunks).
    
    const { data: nds, error: ndError } = await supabase
      .from('notebook_documents')
      .select('document_id')
      .eq('notebook_id', id);
      
    if (ndError) throw ndError;
    if (!nds || nds.length === 0) {
      return NextResponse.json({ topics: [] });
    }
    
    const docIds = nds.map((nd: any) => nd.document_id);
    
    // Get chunks for these docs where userRole is in allowed_roles
    // Since we don't have RLS, we'll do an array containment check.
    const { data: chunks, error: chunkError } = await supabase
      .from('chunks')
      .select('content')
      .in('document_id', docIds)
      .contains('allowed_roles', [userRole]);
      
    if (chunkError) throw chunkError;
    
    if (!chunks || chunks.length === 0) {
      return NextResponse.json({ topics: [] });
    }
    
    // Process a max of 5 chunks per batch
    const batchSize = 5;
    const currentChunks = chunks.slice(offset, offset + batchSize);
    
    if (currentChunks.length === 0) {
      return NextResponse.json({ topics: [], nextOffset: null });
    }
    
    const contextText = currentChunks.map((c: any) => c.content).join('\n\n');
    const hasMore = offset + batchSize < chunks.length;
    const nextOffset = hasMore ? offset + batchSize : null;
    
    if (config.providers.llm.provider === 'groq' && config.providers.llm.groqApiKey) {
      const systemPrompt = `You are a helpful study guide assistant. Based on the provided workspace documents, generate a comprehensive study guide outline.st of structured topics for the user to learn from.
Return a JSON object containing an array of 'topics'. Each topic should have a unique 'id' (short string, e.g., 'topic-1'), a concise 'title', and a 'briefDescription'. Limit to a maximum of 8 key topics.

DOCUMENTS:
${contextText}`;

      const result = await generateText({
        model: groq('llama-3.1-8b-instant'),
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Generate the workspace guide topics.' }],
      });
      
      let parsed = { topics: [] };
      try {
        parsed = JSON.parse(result.text.match(/\{[\s\S]*\}/)?.[0] || '{"topics":[]}');
      } catch (e) {
        console.error('Failed to parse guide JSON:', e);
      }
      
      return NextResponse.json({ ...parsed, nextOffset });
    } else {
      return NextResponse.json({ 
        topics: [
          { id: `mock-${offset}-1`, title: `Mock Topic ${offset + 1}`, briefDescription: 'Mock description' },
          { id: `mock-${offset}-2`, title: `Mock Topic ${offset + 2}`, briefDescription: 'Mock description' }
        ],
        nextOffset
      });
    }

  } catch (err: any) {
    console.error('Guide error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
