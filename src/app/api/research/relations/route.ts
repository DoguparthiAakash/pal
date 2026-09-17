import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/application/services/AuthService';
import { RelationEngine } from '@/infrastructure/research/RelationEngine';

export const maxDuration = 60;

/**
 * GET /api/research/relations?notebookId=xxx&minSimilarity=0.3
 * Returns pre-computed cross-document relations as a graph structure.
 */
export async function GET(req: NextRequest) {
  try {
    const authService = new AuthService();
    const user = await authService.getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const notebookId = req.nextUrl.searchParams.get('notebookId');
    if (!notebookId) return NextResponse.json({ error: 'notebookId required' }, { status: 400 });

    const minSimilarity = parseFloat(req.nextUrl.searchParams.get('minSimilarity') ?? '0.3');

    const graph = await RelationEngine.getRelationGraph(notebookId, user.id, minSimilarity);
    return NextResponse.json(graph);
  } catch (error: any) {
    console.error('Relations GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/research/relations
 * Triggers relation computation for the given notebook.
 * Body: { notebookId, force?: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const authService = new AuthService();
    const user = await authService.getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { notebookId, force = false } = await req.json();
    if (!notebookId) return NextResponse.json({ error: 'notebookId required' }, { status: 400 });

    const result = await RelationEngine.computeRelations(notebookId, user.id, force);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Relations POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
