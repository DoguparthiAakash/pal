import { NextResponse } from 'next/server';
import { adminClient as supabase } from '@/infrastructure/auth/admin';
import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { config } from '@/config';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userRole } = await req.json();
    
    if (!userRole) {
      return NextResponse.json({ error: 'Missing userRole' }, { status: 400 });
    }
    
    const { data: nds, error: ndError } = await supabase
      .from('notebook_documents')
      .select('document_id')
      .eq('notebook_id', id);
      
    if (ndError) throw ndError;
    if (!nds || nds.length === 0) {
      return NextResponse.json({ script: "No documents available for podcast generation." });
    }
    
    const docIds = nds.map((nd: any) => nd.document_id);
    
    const { data: chunks, error: chunkError } = await supabase
      .from('chunks')
      .select('content')
      .in('document_id', docIds)
      .contains('allowed_roles', [userRole]);
      
    if (chunkError) throw chunkError;
    
    if (!chunks || chunks.length === 0) {
      return NextResponse.json({ script: "No accessible content found in this notebook for your role to generate a podcast." });
    }
    
    const contextText = chunks.slice(0, 50).map((c: any) => c.content).join('\n\n');
    
    if (config.providers.llm.provider === 'groq' && config.providers.llm.groqApiKey) {
      const systemPrompt = `You are a podcast host summarizing the key points of the user's workspace documents. Write a short, engaging 2-minute podcast script highlighting the main ideas.cussing the material.

Format:
**Host 1:** ...
**Host 2:** ...

CONTENT:
${contextText}
`;
      const result = await generateText({
        model: groq('llama-3.1-8b-instant'),
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Generate podcast script.' }],
      });
      
      return NextResponse.json({ script: result.text });
    } else {
      return NextResponse.json({ script: "**Host 1:** Welcome to the RAG Podcast!\n\n**Host 2:** Today we are discussing some mock data! [NO GROQ KEY]" });
    }

  } catch (err: any) {
    console.error('Audio error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
