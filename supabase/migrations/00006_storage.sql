-- P4: private storage buckets. Bytes never go in Postgres.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'task-files',
    'task-files',
    false,
    26214400,
    array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/heic',
      'image/heif',
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/csv'
    ]
  ),
  (
    'marca',
    'marca',
    false,
    26214400,
    array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  )
on conflict (id) do nothing;

-- Path: <team_id>/<task_id>/<uuid>-<filename>
-- Read if the caller can read the task (RLS on tasks is the source of truth).
create policy task_files_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'task-files'
    and exists (
      select 1 from public.tasks t
      where t.id::text = (storage.foldername(name))[2]
    )
  );

create policy task_files_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'task-files'
    and exists (
      select 1 from public.tasks t
      where t.id::text = (storage.foldername(name))[2]
    )
  );

create policy task_files_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'task-files'
    and owner = auth.uid()
  );

-- Brand library: every authenticated user except guests. Write: owner/admin.
create policy marca_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'marca'
    and not public.has_role('guest')
  );

create policy marca_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'marca'
    and public.is_owner_or_admin()
  );

create policy marca_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'marca'
    and public.is_owner_or_admin()
  )
  with check (
    bucket_id = 'marca'
    and public.is_owner_or_admin()
  );

create policy marca_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'marca'
    and public.is_owner_or_admin()
  );

create table public.brand_files (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes <= 26214400),
  folder text not null default 'general',
  uploaded_by uuid not null references public.profiles,
  created_at timestamptz not null default now()
);

alter table public.brand_files enable row level security;

create policy brand_files_select on public.brand_files
  for select to authenticated
  using (not public.has_role('guest'));

create policy brand_files_insert on public.brand_files
  for insert to authenticated
  with check (public.is_owner_or_admin() and uploaded_by = auth.uid());

create policy brand_files_delete on public.brand_files
  for delete to authenticated
  using (public.is_owner_or_admin());
