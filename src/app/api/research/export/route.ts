import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/application/services/AuthService';
import { adminClient as supabase } from '@/infrastructure/auth/admin';

export const maxDuration = 60;

/**
 * GET /api/research/export?notebookId=xxx&format=json|csv&type=full|docs|relations|concepts
 *
 * type=full      → Complete KB export (JSON only)
 * type=docs      → Documents list (CSV or JSON)
 * type=relations → Cross-document relations (CSV or JSON)
 * type=concepts  → Memory nodes / concepts (CSV or JSON)
 * type=chunks    → All text chunks (CSV or JSON)
 */
export async function GET(req: NextRequest) {
  try {
    const authService = new AuthService();
    const user = await authService.getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const notebookId = req.nextUrl.searchParams.get('notebookId');
    const format = (req.nextUrl.searchParams.get('format') ?? 'json').toLowerCase();
    const type = (req.nextUrl.searchParams.get('type') ?? 'full').toLowerCase();

    if (!notebookId) return NextResponse.json({ error: 'notebookId required' }, { status: 400 });
    if (!['json', 'csv'].includes(format)) return NextResponse.json({ error: 'format must be json or csv' }, { status: 400 });

    // Verify KB ownership
    const { data: kb } = await supabase
      .from('knowledge_bases')
      .select('id, title, created_at')
      .eq('id', notebookId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!kb) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const baseName = `pal-export-${kb.title.toLowerCase().replace(/\s+/g, '-')}-${timestamp}`;

    // ── Fetch data based on type ───────────────────────────────────────────
    let data: any;
    let filename = `${baseName}-${type}`;  // default, overridden per-type below

    if (type === 'docs' || type === 'full') {
      const { data: docs } = await supabase
        .from('documents')
        .select('id, title, status, mime_type, size, created_at')
        .eq('knowledge_base_id', notebookId)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      // Attach chunk counts
      const { data: chunks } = await supabase
        .from('chunks')
        .select('document_id')
        .eq('knowledge_base_id', notebookId);

      const chunkCounts = new Map<string, number>();
      for (const c of chunks ?? []) {
        chunkCounts.set(c.document_id, (chunkCounts.get(c.document_id) ?? 0) + 1);
      }

      const enrichedDocs = (docs ?? []).map(d => ({
        ...d,
        chunk_count: chunkCounts.get(d.id) ?? 0,
        size_kb: d.size ? Math.round(d.size / 1024) : null,
      }));

      if (type === 'docs') {
        data = enrichedDocs;
        filename = `${baseName}-documents`;
      } else {
        // For 'full', we continue collecting all data
        data = { kb_id: kb.id, kb_title: kb.title, exported_at: new Date().toISOString(), documents: enrichedDocs };
      }
    }

    if (type === 'relations' || type === 'full') {
      const { data: relations } = await supabase
        .from('document_relations')
        .select('source_doc_id, target_doc_id, similarity_score, shared_concepts, computed_at')
        .eq('knowledge_base_id', notebookId)
        .order('similarity_score', { ascending: false });

      // Attach document titles
      const { data: docTitles } = await supabase
        .from('documents')
        .select('id, title')
        .eq('knowledge_base_id', notebookId);

      const titleMap = new Map((docTitles ?? []).map(d => [d.id, d.title]));

      const enrichedRelations = (relations ?? []).map(r => ({
        ...r,
        source_title: titleMap.get(r.source_doc_id) ?? '',
        target_title: titleMap.get(r.target_doc_id) ?? '',
        shared_concepts: r.shared_concepts?.join('; ') ?? '',
      }));

      if (type === 'relations') {
        data = enrichedRelations;
        filename = `${baseName}-relations`;
      } else {
        data.relations = enrichedRelations;
      }
    }

    if (type === 'concepts' || type === 'full') {
      const { data: nodes } = await supabase
        .from('memory_nodes')
        .select('label, type, document_id, created_at')
        .eq('knowledge_base_id', notebookId)
        .order('type', { ascending: true });

      if (type === 'concepts') {
        data = nodes ?? [];
        filename = `${baseName}-concepts`;
      } else {
        data.concepts = nodes ?? [];
      }
    }

    if (type === 'chunks') {
      const { data: chunks } = await supabase
        .from('chunks')
        .select('id, document_id, content')
        .eq('knowledge_base_id', notebookId)
        .eq('user_id', user.id);

      data = chunks ?? [];
      filename = `${baseName}-chunks`;
    }

    if (type === 'full') {
      filename = `${baseName}-full`;
    }

    // ── Serialize ─────────────────────────────────────────────────────────
    if (format === 'json') {
      return new Response(JSON.stringify(data, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}.json"`,
        },
      });
    }

    // CSV: only works for flat arrays
    const rows: any[] = Array.isArray(data) ? data : Object.values(data).find(Array.isArray) as any[] ?? [];
    if (rows.length === 0) {
      return new Response('', {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}.csv"`,
        },
      });
    }

    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.join(','),
      ...rows.map(row =>
        headers.map(h => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          const str = String(val).replace(/"/g, '""');
          return str.includes(',') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
        }).join(',')
      )
    ];

    return new Response(csvLines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    });

  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
