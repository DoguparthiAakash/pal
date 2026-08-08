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
      return NextResponse.json({ guide: 'Upload documents to generate a unified study guide.' });
    }

    const { data: artifacts, error } = await supabase
      .from('workspace_artifacts')
      .select('content')
      .eq('knowledge_base_id', id)
      .eq('document_id', latestDoc.id)
      .eq('type', 'workspace-guide')
      .maybeSingle();
      
    if (error && error.code !== 'PGRST116') throw error;

    if (artifacts?.content) {
      return NextResponse.json({ guide: artifacts.content.text });
    }

    // Generate it dynamically
    const { data: chunks, error: chunkErr } = await supabase
      .from('chunks')
      .select('content')
      .eq('knowledge_base_id', id)
      .limit(30);

    if (chunkErr || !chunks || chunks.length === 0) {
      return NextResponse.json({ guide: 'Upload documents to generate a unified study guide.' });
    }

    const contextText = chunks.map(c => c.content).join('\n\n');

    let model;
    if (config.providers.llm.provider === 'groq' && config.providers.llm.groqApiKey) {
      const groq = createGroq({ apiKey: config.providers.llm.groqApiKey });
      model = groq('llama-3.1-8b-instant');
    } else {
      throw new Error("No supported LLM provider configured");
    }

    const guidePrompt = `Based on the following context gathered from multiple documents in this workspace, synthesize a unified, comprehensive "getting started" study guide. Avoid messy details, provide a cohesive overview of what to learn.\n\nCONTENT:\n${contextText}`;

    const { text: guideText } = await generateText({ model, prompt: guidePrompt });

    // Save as unified artifact attached to latest document
    await supabase.from('workspace_artifacts').upsert({ 
      knowledge_base_id: id, 
      document_id: latestDoc.id, 
      type: 'workspace-guide', 
      content: { text: guideText } 
    });

    return NextResponse.json({ guide: guideText });

  } catch (err: any) {
    console.error('Guide error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
