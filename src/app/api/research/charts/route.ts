import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/application/services/AuthService';
import { adminClient as supabase } from '@/infrastructure/auth/admin';
import { SupabaseCacheService } from '@/infrastructure/cache/SupabaseCacheService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/research/charts?notebookId=xxx
 * Returns structured data for all Research Dashboard charts:
 *
 * - doc_stats:        Per-document info (title, chunk_count, size, status)
 * - concept_stats:    Topic/concept distribution (label, type, count)
 * - timeline:         Documents added over time (date, count)
 * - similarity_matrix: N×N cosine similarity matrix (doc IDs + scores)
 * - cache_stats:      Cache health (total entries, hits, hit rate)
 * - relation_summary: Top connected doc pairs
 * - chunk_distribution: Chunk count per doc (for bar chart)
 */
export async function GET(req: NextRequest) {
  try {
    const authService = new AuthService();
    const user = await authService.getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const notebookId = req.nextUrl.searchParams.get('notebookId');
    if (!notebookId) return NextResponse.json({ error: 'notebookId required' }, { status: 400 });

    // Verify KB ownership
    const { data: kb } = await supabase
      .from('knowledge_bases')
      .select('id, title')
      .eq('id', notebookId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!kb) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Parallel data fetch
    const [docsRes, chunksRes, nodesRes, relationsRes, cacheStats] = await Promise.all([
      supabase
        .from('documents')
        .select('id, title, status, mime_type, size, created_at')
        .eq('knowledge_base_id', notebookId)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true }),

      supabase
        .from('chunks')
        .select('document_id')
        .eq('knowledge_base_id', notebookId)
        .eq('user_id', user.id),

      supabase
        .from('memory_nodes')
        .select('label, type, document_id, metadata')
        .eq('knowledge_base_id', notebookId),

      supabase
        .from('document_relations')
        .select('source_doc_id, target_doc_id, similarity_score, shared_concepts')
        .eq('knowledge_base_id', notebookId)
        .order('similarity_score', { ascending: false })
        .limit(50),

      SupabaseCacheService.getCacheStats(notebookId, user.id),
    ]);

    const docs = docsRes.data ?? [];
    const chunks = chunksRes.data ?? [];
    const nodes = nodesRes.data ?? [];
    const relations = relationsRes.data ?? [];

    // ── chunk_distribution: per-doc chunk counts ──────────────────────────
    const chunkCountByDoc = new Map<string, number>();
    for (const c of chunks) {
      chunkCountByDoc.set(c.document_id, (chunkCountByDoc.get(c.document_id) ?? 0) + 1);
    }

    const doc_stats = docs.map(d => ({
      id: d.id,
      title: d.title,
      status: d.status,
      mime_type: d.mime_type,
      size_kb: d.size ? Math.round(d.size / 1024) : null,
      chunk_count: chunkCountByDoc.get(d.id) ?? 0,
      created_at: d.created_at,
    }));

    // ── concept_stats: concept frequency by type ─────────────────────────
    const conceptFreq = new Map<string, { type: string; count: number }>();
    for (const n of nodes) {
      const key = n.label.toLowerCase();
      if (!conceptFreq.has(key)) {
        conceptFreq.set(key, { type: n.type, count: 0 });
      }
      conceptFreq.get(key)!.count++;
    }

    const concept_stats = [...conceptFreq.entries()]
      .map(([label, { type, count }]) => ({ label, type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 40);

    // ── type_distribution: grouping concepts by type ──────────────────────
    const typeGroups = new Map<string, number>();
    for (const n of nodes) {
      typeGroups.set(n.type, (typeGroups.get(n.type) ?? 0) + 1);
    }
    const type_distribution = [...typeGroups.entries()].map(([type, count]) => ({ type, count }));

    // ── timeline: docs added per day ─────────────────────────────────────
    const dayBuckets = new Map<string, number>();
    for (const d of docs) {
      const day = d.created_at?.split('T')[0] ?? 'unknown';
      dayBuckets.set(day, (dayBuckets.get(day) ?? 0) + 1);
    }
    const timeline = [...dayBuckets.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ── status_breakdown: pie chart data ─────────────────────────────────
    const statusGroups = new Map<string, number>();
    for (const d of docs) {
      statusGroups.set(d.status, (statusGroups.get(d.status) ?? 0) + 1);
    }
    const status_breakdown = [...statusGroups.entries()].map(([status, count]) => ({ status, count }));

    // ── relation_summary: top doc pairs ───────────────────────────────────
    const docTitleMap = new Map(docs.map(d => [d.id, d.title]));
    const relation_summary = relations.slice(0, 10).map(r => ({
      source: docTitleMap.get(r.source_doc_id) ?? r.source_doc_id,
      target: docTitleMap.get(r.target_doc_id) ?? r.target_doc_id,
      source_id: r.source_doc_id,
      target_id: r.target_doc_id,
      similarity: r.similarity_score,
      shared_concepts: r.shared_concepts ?? [],
    }));

    // ── mime type breakdown ───────────────────────────────────────────────
    const mimeGroups = new Map<string, number>();
    for (const d of docs) {
      const label = d.mime_type?.includes('pdf') ? 'PDF'
        : d.mime_type?.includes('word') || d.mime_type?.includes('docx') ? 'Word'
        : d.mime_type?.includes('text') ? 'Text'
        : d.mime_type?.includes('presentation') ? 'Slides'
        : d.mime_type?.includes('spreadsheet') || d.mime_type?.includes('csv') ? 'Spreadsheet'
        : 'Other';
      mimeGroups.set(label, (mimeGroups.get(label) ?? 0) + 1);
    }
    const mime_breakdown = [...mimeGroups.entries()].map(([type, count]) => ({ type, count }));

    return NextResponse.json({
      kb_title: kb.title,
      totals: {
        documents: docs.length,
        chunks: chunks.length,
        concepts: nodes.length,
        unique_concepts: conceptFreq.size,
        relations: relations.length,
        ready_docs: docs.filter(d => d.status === 'Ready').length,
      },
      doc_stats,
      concept_stats,
      type_distribution,
      status_breakdown,
      mime_breakdown,
      timeline,
      relation_summary,
      cache_stats: cacheStats,
    });
  } catch (error: any) {
    console.error('Charts API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
