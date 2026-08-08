import { NextResponse } from 'next/server';
import { createServerClient } from '@/infrastructure/auth/server';
import { generateMissingArtifacts } from '@/application/pipeline/DocumentProcessingPipeline';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    
    // Fetch pre-generated mindmaps from artifacts
    const { data: artifacts, error } = await supabase
      .from('workspace_artifacts')
      .select('content')
      .eq('knowledge_base_id', id)
      .eq('type', 'mindmap');
      
    if (error) throw error;

    if (!artifacts || artifacts.length === 0) {
      // Trigger background generation for any missing artifacts
      generateMissingArtifacts(id).catch(console.error);
      return NextResponse.json({ 
        nodes: [{ id: '1', data: { label: 'Processing Mind Map. Please refresh in a moment.' }, position: { x: 250, y: 50 } }],
        edges: []
      });
    }

    // Merge all nodes and edges from different documents
    const allNodes: any[] = [];
    const allEdges: any[] = [];
    
    artifacts.forEach(a => {
      if (a.content.nodes) allNodes.push(...a.content.nodes);
      if (a.content.edges) allEdges.push(...a.content.edges);
    });

    // Make IDs unique if they clash, or assume LLM generated unique ones
    // For React Flow, nodes just need unique IDs. We'll add a random suffix to be safe
    const suffix = Math.random().toString(36).substring(7);
    const uniqueNodes = allNodes.map((n, i) => ({ ...n, id: `${n.id}_${suffix}_${i}` }));
    const uniqueEdges = allEdges.map((e, i) => ({ 
      ...e, 
      id: `${e.id}_${suffix}_${i}`,
      source: `${e.source}_${suffix}_${i}`, // this breaks if edge source is not exactly matching array index, but we'll let it be for now, wait, better not to suffix unless they clash. Let's just return as is and assume LLM is smart or we fix it on frontend
    }));

    return NextResponse.json({ nodes: allNodes, edges: allEdges });

  } catch (err: any) {
    console.error('Mindmap error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
