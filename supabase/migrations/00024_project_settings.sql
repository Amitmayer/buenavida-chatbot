-- Project settings: notes, due date, members, files, soft-delete helpers.

alter table public.projects
  add column if not exists notes text,
  add column if not exists due_date date;

create table if not exists public.project_members (
  project_id uuid not null references public.projects on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists project_members_user_idx on public.project_members (user_id);

alter table public.project_members enable row level security;

create policy project_members_select on public.project_members
  for select to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and (
          public.is_team_member(p.team_id)
          or (
            not public.is_private_team(p.team_id)
            and public.has_full_access()
          )
        )
    )
  );

create policy project_members_insert on public.project_members
  for insert to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and public.is_team_member(p.team_id)
    )
  );

create policy project_members_delete on public.project_members
  for delete to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and public.is_team_member(p.team_id)
    )
  );

create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  storage_path text not null unique,
  filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  uploaded_by uuid not null references public.profiles,
  created_at timestamptz not null default now()
);

create index if not exists project_files_project_idx
  on public.project_files (project_id, created_at desc);

alter table public.project_files enable row level security;

create policy project_files_select on public.project_files
  for select to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and (
          public.is_team_member(p.team_id)
          or (
            not public.is_private_team(p.team_id)
            and public.has_full_access()
          )
        )
    )
  );

create policy project_files_insert on public.project_files
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id
        and public.is_team_member(p.team_id)
    )
  );

create policy project_files_delete on public.project_files
  for delete to authenticated
  using (
    uploaded_by = auth.uid()
    or exists (
      select 1 from public.projects p
      where p.id = project_id
        and public.is_team_member(p.team_id)
    )
  );

-- Soft-delete stays on archived_at; allow hard delete for team members.
drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
  for delete to authenticated
  using (
    public.is_team_member(team_id)
    or (
      not public.is_private_team(team_id)
      and public.has_full_access()
    )
  );

-- Reuse task-files bucket paths under projects/{id}/...
drop policy if exists project_files_storage_select on storage.objects;
create policy project_files_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'task-files'
    and (storage.foldername(name))[1] = 'projects'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[2]
        and (
          public.is_team_member(p.team_id)
          or (
            not public.is_private_team(p.team_id)
            and public.has_full_access()
          )
        )
    )
  );

drop policy if exists project_files_storage_insert on storage.objects;
create policy project_files_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'task-files'
    and (storage.foldername(name))[1] = 'projects'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[2]
        and public.is_team_member(p.team_id)
    )
  );

drop policy if exists project_files_storage_update on storage.objects;
create policy project_files_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'task-files'
    and (storage.foldername(name))[1] = 'projects'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[2]
        and public.is_team_member(p.team_id)
    )
  );

drop policy if exists project_files_storage_delete on storage.objects;
create policy project_files_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'task-files'
    and (storage.foldername(name))[1] = 'projects'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[2]
        and public.is_team_member(p.team_id)
    )
  );
