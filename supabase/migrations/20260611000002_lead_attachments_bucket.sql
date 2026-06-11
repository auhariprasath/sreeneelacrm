insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lead-attachments',
  'lead-attachments',
  false,
  20971520, -- 20 MB
  array[
    'image/png','image/jpeg','image/jpg','image/webp','image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do nothing;

-- Authenticated users can upload
create policy "auth upload lead-attachments"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'lead-attachments');

-- Authenticated users can read
create policy "auth read lead-attachments"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'lead-attachments');

-- Authenticated users can delete their own uploads
create policy "auth delete lead-attachments"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'lead-attachments');
