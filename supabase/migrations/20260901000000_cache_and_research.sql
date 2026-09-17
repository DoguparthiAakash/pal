-- 20260901000000_cache_and_research.sql
-- Cache Layer + Research Analytics tables

-- ─────────────────────────────────────────────
-- 1. EMBEDDING CACHE
-- Avoids re-running the ONNX model for repeated text
-- ─────────────────────────────────────────────
CREATE TABLE public.embedding_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text_hash       TEXT NOT NULL UNIQUE,           -- SHA-256 of the input text
  text_sample     TEXT,                           -- first 200 chars for debugging
  embedding       vector(384) NOT NULL,
  model           TEXT NOT NULL DEFAULT 'local',
  hit_count       INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX embedding_cache_hash_idx ON public.embedding_cache (text_hash);

-- ─────────────────────────────────────────────
-- 2. QUERY (SEMANTIC) CACHE
-- Caches full LLM responses so identical / near-identical queries are instant
-- ─────────────────────────────────────────────
CREATE TABLE public.query_cache (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  knowledge_base_id   UUID NOT NULL REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
  query_text          TEXT NOT NULL,
  query_embedding     vector(384) NOT NULL,
  response_text       TEXT NOT NULL,
  context_chunk_ids   UUID[] DEFAULT '{}',
  ttl_seconds         INTEGER NOT NULL DEFAULT 7200,  -- 2 hours default
  hit_count           INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 hours')
);

CREATE INDEX query_cache_kb_idx ON public.query_cache (knowledge_base_id);
CREATE INDEX query_cache_expires_idx ON public.query_cache (expires_at);
-- HNSW index for semantic similarity lookups
CREATE INDEX query_cache_embedding_idx ON public.query_cache
  USING hnsw (query_embedding vector_cosine_ops);

-- RPC: find semantically similar cached query
-- Returns the best cache hit above a similarity threshold
CREATE OR REPLACE FUNCTION find_similar_query_cache(
  p_query_embedding   vector(384),
  p_knowledge_base_id UUID,
  p_user_id           UUID,
  p_threshold         FLOAT DEFAULT 0.92
)
RETURNS TABLE (
  id            UUID,
  response_text TEXT,
  similarity    FLOAT,
  hit_count     INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    qc.id,
    qc.response_text,
    1 - (qc.query_embedding <=> p_query_embedding) AS similarity,
    qc.hit_count
  FROM public.query_cache qc
  WHERE
    qc.knowledge_base_id = p_knowledge_base_id
    AND qc.user_id = p_user_id
    AND qc.expires_at > NOW()
    AND (1 - (qc.query_embedding <=> p_query_embedding)) >= p_threshold
  ORDER BY qc.query_embedding <=> p_query_embedding
  LIMIT 1;
END;
$$;

-- RPC: bump hit count + last_used_at on cache hit
CREATE OR REPLACE FUNCTION touch_query_cache(p_cache_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.query_cache
  SET hit_count   = hit_count + 1,
      last_used_at = NOW()
  WHERE id = p_cache_id;
END;
$$;

-- ─────────────────────────────────────────────
-- 3. DOCUMENT RELATIONS
-- Pre-computed pairwise cross-document similarity
-- ─────────────────────────────────────────────
CREATE TABLE public.document_relations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id   UUID NOT NULL REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
  source_doc_id       UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  target_doc_id       UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  relation_type       TEXT NOT NULL DEFAULT 'semantic_similarity',
  similarity_score    FLOAT NOT NULL,
  shared_concepts     TEXT[] DEFAULT '{}',
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_doc_id, target_doc_id, relation_type)
);

CREATE INDEX doc_relations_kb_idx ON public.document_relations (knowledge_base_id);
CREATE INDEX doc_relations_source_idx ON public.document_relations (source_doc_id);

-- ─────────────────────────────────────────────
-- 4. RESEARCH SNAPSHOTS
-- Saved export / analysis snapshots per KB
-- ─────────────────────────────────────────────
CREATE TABLE public.research_snapshots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id   UUID NOT NULL REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_type       TEXT NOT NULL, -- 'chart_export', 'relations_export', 'full_export'
  title               TEXT NOT NULL,
  data                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 5. RLS POLICIES
-- ─────────────────────────────────────────────
ALTER TABLE public.embedding_cache     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_cache         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_relations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_snapshots  ENABLE ROW LEVEL SECURITY;

-- Embedding cache is shared/system-level (no user restriction needed for reads,
-- writes are server-side via service role only)
CREATE POLICY "Embedding cache readable by authenticated users"
  ON public.embedding_cache FOR SELECT
  USING (auth.role() = 'authenticated');

-- Query cache: each user sees only their own entries
CREATE POLICY "Query cache isolated to owner"
  ON public.query_cache FOR ALL
  USING (auth.uid() = user_id);

-- Document relations: isolated by KB ownership
CREATE POLICY "Document relations isolated to KB owner"
  ON public.document_relations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.knowledge_bases kb
      WHERE kb.id = document_relations.knowledge_base_id
      AND kb.user_id = auth.uid()
    )
  );

-- Research snapshots: isolated to owner
CREATE POLICY "Research snapshots isolated to owner"
  ON public.research_snapshots FOR ALL
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 6. UTILITY: Auto-purge expired query cache entries (called by cron or on insert)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION purge_expired_query_cache()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.query_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ─────────────────────────────────────────────
-- 7. RPC: aggregate chart data for a knowledge base
-- Returns doc stats + chunk counts in a single call
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_kb_chart_data(
  p_knowledge_base_id UUID,
  p_user_id           UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result JSONB;
BEGIN
  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM public.knowledge_bases
    WHERE id = p_knowledge_base_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT jsonb_build_object(
    'doc_stats', (
      SELECT jsonb_agg(jsonb_build_object(
        'id',           d.id,
        'title',        d.title,
        'status',       d.status,
        'mime_type',    d.mime_type,
        'size',         d.size,
        'chunk_count',  (SELECT COUNT(*) FROM public.chunks c WHERE c.document_id = d.id),
        'created_at',   d.created_at
      ))
      FROM public.documents d
      WHERE d.knowledge_base_id = p_knowledge_base_id
        AND d.user_id = p_user_id
        AND d.deleted_at IS NULL
    ),
    'concept_stats', (
      SELECT jsonb_agg(jsonb_build_object(
        'label',   mn.label,
        'type',    mn.type,
        'doc_id',  mn.document_id
      ))
      FROM public.memory_nodes mn
      WHERE mn.knowledge_base_id = p_knowledge_base_id
    ),
    'cache_stats', (
      SELECT jsonb_build_object(
        'total_entries', COUNT(*),
        'total_hits',    SUM(hit_count),
        'avg_hits',      ROUND(AVG(hit_count)::numeric, 2)
      )
      FROM public.query_cache
      WHERE knowledge_base_id = p_knowledge_base_id
        AND user_id = p_user_id
        AND expires_at > NOW()
    ),
    'relation_stats', (
      SELECT jsonb_build_object(
        'total_relations', COUNT(*),
        'avg_similarity',  ROUND(AVG(similarity_score)::numeric, 3)
      )
      FROM public.document_relations
      WHERE knowledge_base_id = p_knowledge_base_id
    )
  ) INTO result;

  RETURN result;
END;
$$;
