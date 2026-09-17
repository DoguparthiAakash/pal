import { createHash } from 'crypto';
import { adminClient as supabase } from '@/infrastructure/auth/admin';

export interface CacheHit {
  id: string;
  response_text: string;
  similarity: number;
  hit_count: number;
}

/**
 * SupabaseCacheService
 *
 * Two-tier cache stored in Supabase:
 *
 * 1. Embedding Cache  — avoids re-running the ONNX model for repeated text.
 *    Hash(text) → vector. Shared across all users.
 *
 * 2. Semantic Query Cache — stores full LLM responses keyed by a semantic
 *    embedding. A query with cosine-similarity ≥ 0.92 against a cached query
 *    returns the stored response instantly (~80ms vs ~6s).
 */
export class SupabaseCacheService {
  private static readonly SEMANTIC_THRESHOLD = 0.92;
  private static readonly DEFAULT_TTL_SECONDS = 7200; // 2 hours

  // ─── Embedding Cache ─────────────────────────────────────────────────────

  static hashText(text: string): string {
    return createHash('sha256').update(text.trim().toLowerCase()).digest('hex');
  }

  /**
   * Look up a pre-computed embedding by text hash.
   * Returns null on miss.
   */
  static async getCachedEmbedding(text: string): Promise<number[] | null> {
    const hash = this.hashText(text);
    const { data, error } = await supabase
      .from('embedding_cache')
      .select('embedding')
      .eq('text_hash', hash)
      .maybeSingle();

    if (error || !data) return null;

    // Bump usage count (fire-and-forget)
    supabase
      .from('embedding_cache')
      .update({ hit_count: supabase.rpc('hit_count + 1' as any), last_used_at: new Date().toISOString() })
      .eq('text_hash', hash)
      .then(() => {});

    // Supabase returns vectors as strings like "[0.1,0.2,...]"
    const raw = data.embedding as unknown as string;
    if (typeof raw === 'string') {
      return JSON.parse(raw);
    }
    return data.embedding as unknown as number[];
  }

  /**
   * Store a computed embedding in the cache.
   */
  static async setCachedEmbedding(
    text: string,
    embedding: number[]
  ): Promise<void> {
    const hash = this.hashText(text);
    const sample = text.slice(0, 200);

    await supabase
      .from('embedding_cache')
      .upsert({
        text_hash: hash,
        text_sample: sample,
        embedding: `[${embedding.join(',')}]`,
        model: 'local',
      }, { onConflict: 'text_hash', ignoreDuplicates: true });
  }

  // ─── Semantic Query Cache ─────────────────────────────────────────────────

  /**
   * Look up a semantically similar cached query response.
   * Returns the cached response and similarity score, or null on miss.
   */
  static async getCachedResponse(
    queryEmbedding: number[],
    knowledgeBaseId: string,
    userId: string
  ): Promise<CacheHit | null> {
    try {
      const { data, error } = await supabase.rpc('find_similar_query_cache', {
        p_query_embedding: `[${queryEmbedding.join(',')}]`,
        p_knowledge_base_id: knowledgeBaseId,
        p_user_id: userId,
        p_threshold: this.SEMANTIC_THRESHOLD,
      });

      if (error || !data || data.length === 0) return null;

      const hit = data[0] as CacheHit;

      // Touch (update hit_count + last_used_at) — fire-and-forget
      supabase.rpc('touch_query_cache', { p_cache_id: hit.id }).then(() => {});

      return hit;
    } catch {
      return null;
    }
  }

  /**
   * Write a query+response pair to the semantic cache.
   */
  static async setCachedResponse(params: {
    queryText: string;
    queryEmbedding: number[];
    responseText: string;
    contextChunkIds: string[];
    knowledgeBaseId: string;
    userId: string;
    ttlSeconds?: number;
  }): Promise<void> {
    const ttl = params.ttlSeconds ?? this.DEFAULT_TTL_SECONDS;
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

    try {
      await supabase.from('query_cache').insert({
        user_id: params.userId,
        knowledge_base_id: params.knowledgeBaseId,
        query_text: params.queryText,
        query_embedding: `[${params.queryEmbedding.join(',')}]`,
        response_text: params.responseText,
        context_chunk_ids: params.contextChunkIds,
        ttl_seconds: ttl,
        expires_at: expiresAt,
      });
    } catch {
      // Non-fatal — cache write failures should never break the user flow
    }
  }

  /**
   * Invalidate all cached responses for a knowledge base.
   * Call this when a new document is added so stale answers are cleared.
   */
  static async invalidateKBCache(knowledgeBaseId: string): Promise<void> {
    try {
      await supabase
        .from('query_cache')
        .delete()
        .eq('knowledge_base_id', knowledgeBaseId);
    } catch {
      // Non-fatal
    }
  }

  /**
   * Get cache statistics for a knowledge base.
   */
  static async getCacheStats(
    knowledgeBaseId: string,
    userId: string
  ): Promise<{ total: number; hits: number; hitRate: number }> {
    const { data } = await supabase
      .from('query_cache')
      .select('hit_count')
      .eq('knowledge_base_id', knowledgeBaseId)
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString());

    if (!data || data.length === 0) return { total: 0, hits: 0, hitRate: 0 };

    const total = data.length;
    const hits = data.reduce((sum, r) => sum + (r.hit_count || 0), 0);
    return { total, hits, hitRate: total > 0 ? hits / (hits + total) : 0 };
  }

  /**
   * Purge expired entries (call occasionally from a background route).
   */
  static async purgeExpired(): Promise<number> {
    try {
      const { data } = await supabase.rpc('purge_expired_query_cache');
      return data ?? 0;
    } catch {
      return 0;
    }
  }
}
