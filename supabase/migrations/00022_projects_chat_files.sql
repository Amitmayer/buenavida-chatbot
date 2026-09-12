-- Projects live inside teams (áreas). Tasks may optionally belong to a project.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  created_by uuid not null references public.profiles,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index projects_team_idx on public.projects (team_id, created_at desc);

alter table public.tasks
  add column if not exists project_id uuid references public.projects on delete set null;

create index if not exists tasks_project_idx on public.tasks (project_id)
  where project_id is not null;

alter table public.projects enable row level security;

create policy projects_select on public.projects
  for select to authenticated
  using (
    public.is_team_member(team_id)
    or (
      not public.is_private_team(team_id)
      and public.has_full_access()
    )
  );

create policy projects_insert on public.projects
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      public.is_team_member(team_id)
      or (
        not public.is_private_team(team_id)
        and public.has_full_access()
      )
    )
  );

create policy projects_update on public.projects
  for update to authenticated
  using (
    public.is_team_member(team_id)
    or (
      not public.is_private_team(team_id)
      and public.has_full_access()
    )
  )
  with check (
    public.is_team_member(team_id)
    or (
      not public.is_private_team(team_id)
      and public.has_full_access()
    )
  );

-- Chat attachments for any chat the user belongs to (DMs, groups, team rooms).
-- Reuse channel_files table; broaden policies beyond kind = 'channel'.
drop policy if exists channel_files_select on public.channel_files;
create policy channel_files_select on public.channel_files
  for select to authenticated
  using (public.is_chat_member(chat_id));

drop policy if exists channel_files_insert on public.channel_files;
create policy channel_files_insert on public.channel_files
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and public.is_chat_member(chat_id)
  );

alter table public.chat_messages
  add column if not exists attachment_id uuid references public.channel_files on delete set null;

-- Storage: allow any chat membership (not only work channels).
drop policy if exists channel_files_storage_select on storage.objects;
create policy channel_files_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'channel-files'
    and exists (
      select 1 from public.chats c
      where c.id::text = (storage.foldername(name))[1]
        and public.is_chat_member(c.id)
    )
  );

drop policy if exists channel_files_storage_insert on storage.objects;
create policy channel_files_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'channel-files'
    and exists (
      select 1 from public.chats c
      where c.id::text = (storage.foldername(name))[1]
        and public.is_chat_member(c.id)
    )
  );
