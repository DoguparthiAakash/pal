import { NextResponse } from 'next/server';
import { createServerClient } from '@/infrastructure/auth/server';
import { generateMissingArtifacts } from '@/application/pipeline/DocumentProcessingPipeline';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    
    const { data: artifacts, error } = await supabase
      .from('workspace_artifacts')
      .select('content')
      .eq('knowledge_base_id', id)
      .eq('type', 'notes');
      
    if (error) throw error;

    if (!artifacts || artifacts.length === 0) {
      // Trigger background generation for any missing artifacts
      generateMissingArtifacts(id).catch(console.error);
    }

    let combinedTopics: any[] = [];
    artifacts?.forEach(a => {
      if (a.content.topics) {
        combinedTopics.push(...a.content.topics);
      }
    });

    return NextResponse.json({ topics: combinedTopics });
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
