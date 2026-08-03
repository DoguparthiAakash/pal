import { NextResponse } from 'next/server';
import { createServerClient } from '@/infrastructure/auth/server';
import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { config } from '@/config';
import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const { userRole, offset = 0 } = await req.json();
    
    if (!userRole) {
      return NextResponse.json({ error: 'Missing userRole' }, { status: 400 });
    }
    
    const { data: nds, error: ndError } = await supabase
      .from('notebook_documents')
      .select('document_id')
      .eq('notebook_id', id);
      
    if (ndError) throw ndError;
    if (!nds || nds.length === 0) {
      return NextResponse.json({ 
        nodes: [{ id: '1', data: { label: 'Empty Workspace' }, position: { x: 250, y: 50 } }],
        edges: []
      });
    }
    
    const docIds = nds.map((nd: any) => nd.document_id);
    
    const { data: chunks, error: chunkError } = await supabase
      .from('chunks')
      .select('content')
      .in('document_id', docIds)
      .contains('allowed_roles', [userRole]);
      
    if (chunkError) throw chunkError;
    
    if (!chunks || chunks.length === 0) {
      return NextResponse.json({ 
        nodes: [{ id: '1', data: { label: 'No Accessible Content' }, position: { x: 250, y: 50 } }],
        edges: []
      });
    }
    
    // Process a max of 5 chunks per batch
    const batchSize = 5;
    const currentChunks = chunks.slice(offset, offset + batchSize);
    
    if (currentChunks.length === 0) {
      return NextResponse.json({ mermaid: "", nextOffset: null });
    }
    
    const contextText = currentChunks.map((c: any) => c.content).join('\n\n');
    const hasMore = offset + batchSize < chunks.length;
    const nextOffset = hasMore ? offset + batchSize : null;
    
    let model;
    if (config.providers.llm.provider === 'groq' && config.providers.llm.groqApiKey) {
      model = createGroq({ apiKey: config.providers.llm.groqApiKey })('llama3-8b-8192');
    } else if (config.providers.llm.provider === 'openai' && config.providers.llm.openaiApiKey) {
      model = createOpenAI({ apiKey: config.providers.llm.openaiApiKey })('gpt-4o-mini');
    }

    if (model) {
      const isFirst = offset === 0;
      
      const systemPrompt = `You are a helpful company assistant. Based on the following workspace content, generate a structured top-down flowchart representing key topics and their relationships using Mermaid.js syntax.
Output ONLY the raw Mermaid diagram string. Do not wrap it in markdown code blocks.

CRITICAL INSTRUCTIONS:
${isFirst ? '- You MUST start the flowchart exactly with "flowchart TD".' : '- DO NOT include the "flowchart TD" header. Output ONLY the node relationships/edges.'}
- Use simple square brackets for node text without quotes, e.g., A[Topic Name].
- Use standard arrows (-->) for connections.
- DO NOT output any <tool_call> tags, do not attempt to use tools, and DO NOT output XML. Just raw Mermaid.
- Example of desired format:
${isFirst ? 'flowchart TD\n' : ''}  Root[Main Subject] --> T1[Topic 1]
  Root --> T2[Topic 2]
  T1 --> S1[Subtopic 1]

CONTENT:
${contextText}
`;
      const { text } = await generateText({
        model: groq('llama-3.1-8b-instant'),
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Generate mermaid UML graph relationships.' }],
      });
      
      return NextResponse.json({ mermaid: text, nextOffset });
    } else {
      const isFirst = offset === 0;
      return NextResponse.json({ 
        mermaid: isFirst ? `flowchart TD\n  Mock[Mock Root ${offset}]` : `\n  Mock[Mock Root ${offset}] --> T[Topic ${offset}]`,
        nextOffset
      });
    }

  } catch (err: any) {
    console.error('Mindmap error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
