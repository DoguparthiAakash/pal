-- Enable pgvector
create extension if not exists vector;

-- Users table
create table public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null
);

-- Documents table
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  uploaded_by uuid references public.users(id),
  created_at timestamp with time zone default now(),
  allowed_roles text[] not null default '{}',
  allowed_user_ids uuid[] not null default '{}'
);

-- Chunks table
create table public.chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  content text not null,
  embedding vector(1536),
  allowed_roles text[] not null default '{}',
  allowed_user_ids uuid[] not null default '{}'
);

-- Conversations table
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  created_at timestamp with time zone default now()
);

-- Messages table
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null, -- 'user', 'assistant', 'system'
  content text not null,
  cited_chunk_ids uuid[] default '{}',
  created_at timestamp with time zone default now()
);

-- HNSW index for fast similarity search
create index on chunks using hnsw (embedding vector_ip_ops);

-- Similarity search RPC function with ACL filtering
create or replace function match_chunks(
  query_embedding vector(1536),
  match_count int default 6,
  user_role text default null,
  user_id uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    c.id,
    c.document_id,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.chunks c
  where
    (user_role is not null and user_role = any(c.allowed_roles))
    or (user_id is not null and user_id = any(c.allowed_user_ids))
  order by c.embedding <=> query_embedding
  limit match_count;
end;
$$;
