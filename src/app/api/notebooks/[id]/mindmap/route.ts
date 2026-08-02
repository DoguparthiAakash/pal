import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { z } from 'zod';

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
    
    const contextText = chunks.slice(0, 40).map((c: any) => c.content).join('\n\n');
    
    if (process.env.GROQ_API_KEY) {
      const systemPrompt = `You are a helpful company assistant. Based on the following workspace content, generate a structured top-down flowchart representing key topics and their relationships using Mermaid.js syntax.
Output ONLY the raw Mermaid diagram string (starting with \`flowchart TD\`). Do not wrap it in markdown code blocks.

CRITICAL INSTRUCTIONS:
- You MUST use a top-down flowchart starting exactly with "flowchart TD".
- Use simple square brackets for node text without quotes, e.g., A[Topic Name].
- Use standard arrows (-->) for connections.
- Create a logical, branching tree structure starting from a single root node.
- DO NOT output any <tool_call> tags, do not attempt to use tools, and DO NOT output XML. Just raw Mermaid.
- Example of desired format:
flowchart TD
  Root[Main Subject] --> T1[Topic 1]
  Root --> T2[Topic 2]
  T1 --> S1[Subtopic 1]
  T1 --> S2[Subtopic 2]

CONTENT:
${contextText}
`;
      const { text } = await generateText({
        model: groq('llama-3.3-70b-versatile'),
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Generate mermaid UML graph.' }],
      });
      
      return NextResponse.json({ mermaid: text });
    } else {
      return NextResponse.json({ 
        mermaid: `flowchart TD
  Mock[No Groq Key]`
      });
    }

  } catch (err: any) {
    console.error('Mindmap error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
