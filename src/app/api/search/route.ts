import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/application/services/AuthService';
import { SupabaseVectorStore } from '@/infrastructure/vector/SupabaseVectorStore';
import { EmbeddingProviderFactory } from '@/infrastructure/embeddings/EmbeddingProviderFactory';
import { adminClient as supabase } from '@/infrastructure/auth/admin';
import { SupabaseCacheService } from '@/infrastructure/cache/SupabaseCacheService';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const authService = new AuthService();
    const user = await authService.getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const notebookId = req.nextUrl.searchParams.get('notebookId');
    const query = req.nextUrl.searchParams.get('q');
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20', 10);
    const threshold = parseFloat(req.nextUrl.searchParams.get('threshold') || '0.3');

    if (!notebookId || !query) {
      return NextResponse.json({ error: 'notebookId and q are required' }, { status: 400 });
    }

    // 1. Verify KB ownership
    const { data: kb } = await supabase
      .from('knowledge_bases')
      .select('id')
      .eq('id', notebookId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!kb) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // 2. Embed the query (utilizing embedding cache)
    const embeddingProvider = EmbeddingProviderFactory.create();
    const [queryEmbedding] = await embeddingProvider.generateEmbeddings([query]);

    // 3. Search chunks
    const vectorStore = new SupabaseVectorStore();
    const chunks = await vectorStore.searchChunks(queryEmbedding, limit, user.id, notebookId, threshold);

    if (chunks.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // 4. Enrich chunks with document metadata
    const documentIds = [...new Set(chunks.map(c => c.document_id))];
    const { data: documents } = await supabase
      .from('documents')
      .select('id, title, mime_type, created_at')
      .in('id', documentIds);

    const docMap = new Map((documents || []).map(d => [d.id, d]));

    const results = chunks.map(chunk => {
      const doc = docMap.get(chunk.document_id);
      return {
        id: chunk.id,
        content: chunk.content,
        similarity: chunk.similarity,
        document: doc ? {
          id: doc.id,
          title: doc.title,
          mime_type: doc.mime_type,
          created_at: doc.created_at
        } : null
      };
    });

    return NextResponse.json({ results });

  } catch (error: any) {
    console.error('Search API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
