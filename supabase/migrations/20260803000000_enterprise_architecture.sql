-- 20260803000000_enterprise_architecture.sql

-- 1. Wipe existing data for clean multi-tenant transition
TRUNCATE TABLE public.messages CASCADE;
TRUNCATE TABLE public.conversations CASCADE;
TRUNCATE TABLE public.chunks CASCADE;
TRUNCATE TABLE public.notebook_documents CASCADE;
TRUNCATE TABLE public.notes CASCADE;
TRUNCATE TABLE public.documents CASCADE;
TRUNCATE TABLE public.notebooks CASCADE;
TRUNCATE TABLE public.users CASCADE;

-- 2. Extend Users Table & Auth Sync
ALTER TABLE public.users 
  ADD COLUMN email text,
  ADD COLUMN avatar text,
  ADD COLUMN provider text,
  ADD COLUMN created_at timestamp with time zone default now(),
  ADD COLUMN updated_at timestamp with time zone default now(),
  ADD COLUMN documents_uploaded int default 0,
  ADD COLUMN storage_used bigint default 0,
  ADD COLUMN messages_used int default 0,
  ADD COLUMN last_active timestamp with time zone default now();

-- Trigger to sync auth.users to public.users
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, avatar, provider, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    COALESCE(new.raw_app_meta_data->>'provider', 'email'),
    'user'
  );
  
  -- Create default Knowledge Base for new user
  INSERT INTO public.knowledge_bases (user_id, title, is_default, settings)
  VALUES (
    new.id,
    'Personal Knowledge Base',
    true,
    '{"embedding_provider": "openai", "llm_provider": "groq", "chunk_size": 400, "chunk_overlap": 60, "top_k": 15, "similarity_threshold": 0.7, "max_context_length": 15000, "temperature": 0.5, "retrieval_strategy": "vector"}'::jsonb
  );
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 3. Knowledge Bases
CREATE TABLE public.knowledge_bases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  is_default boolean default false,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone
);

-- 4. Extend Documents
ALTER TABLE public.documents
  DROP COLUMN uploaded_by,
  ADD COLUMN user_id uuid not null references public.users(id) on delete cascade,
  ADD COLUMN knowledge_base_id uuid not null references public.knowledge_bases(id) on delete cascade,
  ADD COLUMN original_name text not null,
  ADD COLUMN storage_path text not null,
  ADD COLUMN mime_type text,
  ADD COLUMN size bigint,
  ADD COLUMN status text not null default 'Pending',
  ADD COLUMN updated_at timestamp with time zone default now(),
  ADD COLUMN deleted_at timestamp with time zone;

-- 5. Extend Chunks
ALTER TABLE public.chunks
  ADD COLUMN user_id uuid not null references public.users(id) on delete cascade,
  ADD COLUMN knowledge_base_id uuid not null references public.knowledge_bases(id) on delete cascade;

-- 6. Extend Conversations & Messages
ALTER TABLE public.conversations
  ADD COLUMN knowledge_base_id uuid not null references public.knowledge_bases(id) on delete cascade,
  ADD COLUMN updated_at timestamp with time zone default now(),
  ADD COLUMN deleted_at timestamp with time zone;

ALTER TABLE public.messages
  DROP COLUMN cited_chunk_ids,
  ADD COLUMN sources jsonb,
  ADD COLUMN provider_used text,
  ADD COLUMN generation_metadata jsonb;


-- 7. ENABLE ROW LEVEL SECURITY (RLS)

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebook_documents ENABLE ROW LEVEL SECURITY;

-- 8. CREATE RLS POLICIES

-- Users
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Knowledge Bases
CREATE POLICY "KBs isolated to owner" ON public.knowledge_bases FOR ALL USING (auth.uid() = user_id);

-- Documents
CREATE POLICY "Docs isolated to owner" ON public.documents FOR ALL USING (auth.uid() = user_id);

-- Chunks
CREATE POLICY "Chunks isolated to owner" ON public.chunks FOR ALL USING (auth.uid() = user_id);

-- Conversations
CREATE POLICY "Conversations isolated to owner" ON public.conversations FOR ALL USING (auth.uid() = user_id);

-- Messages (derived via conversation)
CREATE POLICY "Messages isolated to owner" ON public.messages FOR ALL USING (
  EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND c.user_id = auth.uid())
);

-- Notebooks
CREATE POLICY "Notebooks isolated to owner" ON public.notebooks FOR ALL USING (auth.uid() = owner_id);

-- Notes
CREATE POLICY "Notes isolated to owner" ON public.notes FOR ALL USING (auth.uid() = user_id);


-- 9. UPDATE MATCH_CHUNKS RPC

DROP FUNCTION IF EXISTS public.match_chunks(vector, int, text, uuid);
DROP FUNCTION IF EXISTS public.match_chunks_in_notebook(vector, int, text, uuid, uuid);

CREATE OR REPLACE FUNCTION match_chunks_in_kb(
  query_embedding vector(384),
  match_count int,
  p_knowledge_base_id uuid,
  p_user_id uuid,
  similarity_threshold float default 0.0
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Strict explicit check independent of RLS
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required for vector search isolation';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.chunks c
  JOIN public.documents d ON c.document_id = d.id
  WHERE
    c.knowledge_base_id = p_knowledge_base_id
    AND c.user_id = p_user_id
    AND d.status = 'Ready'
    AND d.deleted_at IS NULL
    AND (1 - (c.embedding <=> query_embedding)) > similarity_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


CREATE OR REPLACE FUNCTION match_chunks_in_notebook(
  query_embedding vector(384),
  match_count int,
  p_notebook_id uuid,
  p_user_id uuid,
  similarity_threshold float default 0.0
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required for vector search isolation';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.chunks c
  JOIN public.documents d ON c.document_id = d.id
  JOIN public.notebook_documents nd ON c.document_id = nd.document_id
  WHERE
    nd.notebook_id = p_notebook_id
    AND c.user_id = p_user_id
    AND d.status = 'Ready'
    AND d.deleted_at IS NULL
    AND (1 - (c.embedding <=> query_embedding)) > similarity_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
