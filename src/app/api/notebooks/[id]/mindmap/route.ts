import { NextResponse } from 'next/server';
import { createServerClient } from '@/infrastructure/auth/server';
import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { config } from '@/config';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    
    // Get the latest document to attach the workspace artifact to
    const { data: latestDoc } = await supabase
      .from('documents')
      .select('id')
      .eq('knowledge_base_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!latestDoc) {
      return NextResponse.json({ 
        nodes: [{ id: '1', data: { label: 'Upload documents to generate a mind map.' }, position: { x: 250, y: 50 } }],
        edges: []
      });
    }

    // Fetch pre-generated workspace-unified mindmap
    const { data: artifacts, error } = await supabase
      .from('workspace_artifacts')
      .select('content')
      .eq('knowledge_base_id', id)
      .eq('document_id', latestDoc.id)
      .eq('type', 'workspace-mindmap')
      .maybeSingle();
      
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is no rows returned

    if (artifacts?.content) {
      return NextResponse.json(artifacts.content);
    }

    // Generate it dynamically
    const { data: chunks, error: chunkErr } = await supabase
      .from('chunks')
      .select('content')
      .eq('knowledge_base_id', id)
      .limit(30);

    if (chunkErr || !chunks || chunks.length === 0) {
      return NextResponse.json({ 
        nodes: [{ id: '1', data: { label: 'Upload documents to generate a mind map.' }, position: { x: 250, y: 50 } }],
        edges: []
      });
    }

    const contextText = chunks.map(c => c.content).join('\n\n');

    let model;
    if (config.providers.llm.provider === 'groq' && config.providers.llm.groqApiKey) {
      const groq = createGroq({ apiKey: config.providers.llm.groqApiKey });
      model = groq('llama-3.1-8b-instant');
    } else {
      throw new Error("No supported LLM provider configured");
    }

    const extractJson = (text: string) => {
      const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      return match ? match[0] : text;
    };

    const mindmapPrompt = `Based on the following context gathered from multiple documents in this workspace, synthesize a unified, comprehensive Mind Map bridging concepts together. Format strictly as JSON matching React Flow nodes/edges: { "nodes": [{ "id": "1", "data": { "label": "Topic" }, "position": { "x": 0, "y": 0 } }], "edges": [{ "id": "e1-2", "source": "1", "target": "2" }] }.\n\nCONTENT:\n${contextText}`;

    const { text: mindmapJsonStr } = await generateText({ model, prompt: mindmapPrompt });
    const parsedMindmap = JSON.parse(extractJson(mindmapJsonStr));

    // Save as unified artifact attached to latest document
    await supabase.from('workspace_artifacts').upsert({ 
      knowledge_base_id: id, 
      document_id: latestDoc.id, 
      type: 'workspace-mindmap', 
      content: parsedMindmap 
    });

    return NextResponse.json(parsedMindmap);

  } catch (err: any) {
    console.error('Mindmap error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
