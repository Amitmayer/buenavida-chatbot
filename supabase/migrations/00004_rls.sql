-- P0-4: RLS helpers and policies on every table.
-- Access control lives here, never in a JavaScript `if`.

create or replace function public.is_team_member(t uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where team_id = t and user_id = auth.uid()
  );
$$;

create or replace function public.has_role(r public.user_role)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = r
  );
$$;

create or replace function public.is_owner_or_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner', 'admin')
  );
$$;

revoke all on function public.is_team_member(uuid) from public;
revoke all on function public.has_role(public.user_role) from public;
revoke all on function public.is_owner_or_admin() from public;
grant execute on function public.is_team_member(uuid) to authenticated;
grant execute on function public.has_role(public.user_role) to authenticated;
grant execute on function public.is_owner_or_admin() to authenticated;

-- Allow JWT impersonation in tests and in PostgREST.
-- set_config on request.jwt.claims is permitted for authenticated in Supabase.

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_events enable row level security;
alter table public.attachments enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.tool_calls enable row level security;
alter table public.digest_runs enable row level security;

-- profiles: readable by every authenticated user (assignee picker).
-- writable only by owner or admin. is_admin does not imply read-all on tasks.
create policy profiles_select on public.profiles
  for select to authenticated
  using (true);

create policy profiles_update on public.profiles
  for update to authenticated
  using (public.is_owner_or_admin())
  with check (public.is_owner_or_admin());

create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (public.is_owner_or_admin() or id = auth.uid());

-- teams
create policy teams_select on public.teams
  for select to authenticated
  using (true);

create policy teams_insert on public.teams
  for insert to authenticated
  with check (public.is_owner_or_admin());

create policy teams_update on public.teams
  for update to authenticated
  using (public.is_owner_or_admin())
  with check (public.is_owner_or_admin());

-- team_members
create policy team_members_select on public.team_members
  for select to authenticated
  using (true);

create policy team_members_insert on public.team_members
  for insert to authenticated
  with check (public.is_owner_or_admin());

create policy team_members_update on public.team_members
  for update to authenticated
  using (public.is_owner_or_admin())
  with check (public.is_owner_or_admin());

create policy team_members_delete on public.team_members
  for delete to authenticated
  using (public.is_owner_or_admin());

-- tasks
create policy tasks_read on public.tasks
  for select to authenticated
  using (
    owner_id = auth.uid()
    or assignee_id = auth.uid()
    or public.has_role('owner')
    or (
      visibility = 'team'
      and public.is_team_member(team_id)
      and not public.has_role('guest')
    )
  );

create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (
    public.is_team_member(team_id) and created_by = auth.uid()
  );

create policy tasks_update on public.tasks
  for update to authenticated
  using (
    owner_id = auth.uid()
    or assignee_id = auth.uid()
    or (
      visibility = 'team'
      and public.is_team_member(team_id)
      and not public.has_role('guest')
    )
  )
  with check (
    owner_id = auth.uid()
    or assignee_id = auth.uid()
    or (
      visibility = 'team'
      and public.is_team_member(team_id)
      and not public.has_role('guest')
    )
  );

-- task_events inherit the parent task's read rule.
create policy task_events_read on public.task_events
  for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));

create policy task_events_insert on public.task_events
  for insert to authenticated
  with check (
    actor_id = auth.uid()
    and exists (select 1 from public.tasks t where t.id = task_id)
  );

-- attachments inherit the task's rule.
create policy attachments_read on public.attachments
  for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));

create policy attachments_insert on public.attachments
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (select 1 from public.tasks t where t.id = task_id)
  );

create policy attachments_delete on public.attachments
  for delete to authenticated
  using (
    uploaded_by = auth.uid()
    or public.is_owner_or_admin()
  );

-- conversations / messages / tool_calls: owning user only. No shared chat.
create policy conversations_all on public.conversations
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy messages_all on public.messages
  for all to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

create policy tool_calls_all on public.tool_calls
  for all to authenticated
  using (
    exists (
      select 1
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = message_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = message_id and c.user_id = auth.uid()
    )
  );

-- digest_runs: a person may read their own row. Cron writes with the service role.
create policy digest_runs_select on public.digest_runs
  for select to authenticated
  using (user_id = auth.uid());
