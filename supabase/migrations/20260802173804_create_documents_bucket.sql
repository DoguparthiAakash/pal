insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'documents' );

create policy "Allow all uploads"
  on storage.objects for insert
  with check ( bucket_id = 'documents' );
