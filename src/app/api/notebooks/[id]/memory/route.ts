import { NextResponse } from 'next/server';
import { createServerClient } from '@/infrastructure/auth/server';
import { generateMissingArtifacts } from '@/application/pipeline/DocumentProcessingPipeline';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    
    // We fetch all memory nodes and edges for the given knowledge base
    const { data: nodes, error: nodesError } = await supabase
      .from('memory_nodes')
      .select('*')
      .eq('knowledge_base_id', id);
      
    if (nodesError) throw nodesError;

    if (!nodes || nodes.length === 0) {
      // Trigger background generation for any missing artifacts
      generateMissingArtifacts(id).catch(console.error);
    }

    const { data: edges, error: edgesError } = await supabase
      .from('memory_edges')
      .select('*, source:source_node_id, target:target_node_id')
      // Edge filtering requires a join or just fetching all if small, but let's just fetch all related edges
      // In a real app we'd filter edges where source/target are in `nodes`
      // For now we'll fetch all edges and filter in memory since we don't have a complex join set up
      // Or we can just let React Flow handle it
      ;
      
    if (edgesError) throw edgesError;

    // Filter edges to only those connecting the nodes we have
    const nodeIds = new Set(nodes?.map(n => n.id) || []);
    const validEdges = edges?.filter(e => nodeIds.has(e.source_node_id) && nodeIds.has(e.target_node_id)) || [];

    // Transform into React Flow format
    const rfNodes = (nodes || []).map((n, i) => ({
      id: n.id,
      data: { label: n.label, type: n.type },
      position: { x: Math.random() * 500, y: Math.random() * 500 }, // Random positions for force layout start
      type: 'default',
    }));

    const rfEdges = validEdges.map(e => ({
      id: e.id,
      source: e.source_node_id,
      target: e.target_node_id,
      label: e.relationship_type,
    }));

    return NextResponse.json({ nodes: rfNodes, edges: rfEdges });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
