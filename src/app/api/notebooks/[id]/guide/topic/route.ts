import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userRole, topic } = await req.json();
    
    if (!userRole || !topic) {
      return NextResponse.json({ error: 'Missing userRole or topic' }, { status: 400 });
    }
    
    const { data: nds, error: ndError } = await supabase
      .from('notebook_documents')
      .select('document_id')
      .eq('notebook_id', id);
      
    if (ndError) throw ndError;
    if (!nds || nds.length === 0) {
      return NextResponse.json({ content: "This workspace is empty." });
    }
    
    const docIds = nds.map((nd: any) => nd.document_id);
    
    const { data: chunks, error: chunkError } = await supabase
      .from('chunks')
      .select('content')
      .in('document_id', docIds)
      .contains('allowed_roles', [userRole]);
      
    if (chunkError) throw chunkError;
    
    if (!chunks || chunks.length === 0) {
      return NextResponse.json({ content: "No accessible content found for this topic." });
    }
    
    const contextText = chunks.slice(0, 50).map((c: any) => c.content).join('\n\n');
    
    if (process.env.GROQ_API_KEY) {
      const systemPrompt = `You are a helpful study guide assistant. Based on the provided workspace documents, write a detailed explanation and deep-dive for the specific topic requested by the user.
Use markdown headings, bullet points, and code blocks if applicable.

DOCUMENTS:
${contextText}`;

      const result = await generateText({
        model: groq('llama-3.1-8b-instant'),
        system: systemPrompt,
        messages: [{ role: 'user', content: `Please explain the following topic in detail: ${topic}` }],
      });
      
      return NextResponse.json({ content: result.text });
    } else {
      return NextResponse.json({ content: `### Detailed Guide on: ${topic}\n\n[MOCK CONTENT - NO GROQ KEY]` });
    }

  } catch (err: any) {
    console.error('Guide topic error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
