-- Notebooks table
create table public.notebooks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.users(id),
  title text not null,
  created_at timestamp with time zone default now()
);

-- Notebook Documents junction table
create table public.notebook_documents (
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  primary key (notebook_id, document_id)
);

-- Notes table
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  content text not null,
  created_at timestamp with time zone default now()
);

-- match_chunks_in_notebook function
create or replace function match_chunks_in_notebook(
  query_embedding vector(384),
  match_count int,
  user_role text,
  user_id uuid,
  p_notebook_id uuid
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
  join public.notebook_documents nd on c.document_id = nd.document_id
  where
    nd.notebook_id = p_notebook_id
    and (
      (user_role is not null and user_role = any(c.allowed_roles))
      or (user_id is not null and user_id = any(c.allowed_user_ids))
    )
  order by c.embedding <=> query_embedding
  limit match_count;
end;
$$;
