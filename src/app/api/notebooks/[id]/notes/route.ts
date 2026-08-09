import { NextResponse } from 'next/server';
import { createServerClient } from '@/infrastructure/auth/server';
import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { config } from '@/config';
import { TavilyClient } from '@/infrastructure/tavily/TavilyClient';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
      return NextResponse.json({ topics: [] });
    }

    const { data: artifacts, error } = await supabase
      .from('workspace_artifacts')
      .select('content')
      .eq('knowledge_base_id', id)
      .eq('document_id', latestDoc.id)
      .eq('type', 'workspace-notes')
      .maybeSingle();
      
    if (error && error.code !== 'PGRST116') throw error;

    if (artifacts?.content) {
      return NextResponse.json({ topics: artifacts.content.topics });
    }

    // Generate it dynamically
    const { data: chunks, error: chunkErr } = await supabase
      .from('chunks')
      .select('content')
      .eq('knowledge_base_id', id)
      .limit(8);

    if (chunkErr || !chunks || chunks.length === 0) {
      return NextResponse.json({ topics: [] });
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
      const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (mdMatch) return mdMatch[1];
      const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      return match ? match[0] : text;
    };

    const notesPrompt = `Based on the following context gathered from multiple documents in this workspace, synthesize unified short bullet point notes on each key topic bridging concepts across documents. Format strictly as JSON with { "topics": [{ "topic": "Name", "points": ["p1"] }] }. Output EXACTLY ONE valid JSON object inside a \`\`\`json code block. Do not add any conversational text.\n\nCONTENT:\n${contextText}`;

    let parsedNotes: any = { topics: [] };
    try {
      const { text: notesJsonStr } = await generateText({ model, prompt: notesPrompt });
      parsedNotes = JSON.parse(extractJson(notesJsonStr));
    } catch (llmErr) {
      console.error('LLM rate limit or generation error in notes route:', llmErr);
      return NextResponse.json({ topics: [] });
    }

    const tavily = new TavilyClient();
    for (const t of parsedNotes.topics || []) {
      try {
        t.links = await tavily.search(t.topic + ' ' + t.points[0], 3);
      } catch (linkError) {
        console.error('Tavily search failed for topic', t.topic, linkError);
        t.links = [];
      }
    }

    // Save as unified artifact attached to latest document
    await supabase.from('workspace_artifacts').upsert({ 
      knowledge_base_id: id, 
      document_id: latestDoc.id, 
      type: 'workspace-notes', 
      content: parsedNotes 
    });

    return NextResponse.json({ topics: parsedNotes.topics });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { chunk_id, content } = await req.json();
    
    if (!content) {
      return NextResponse.json({ error: 'Missing content' }, { status: 400 });
    }
    
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { data, error } = await supabase
      .from('notes')
      .insert({
        notebook_id: id,
        user_id: user.id,
        content
      })
      .select();
      
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
