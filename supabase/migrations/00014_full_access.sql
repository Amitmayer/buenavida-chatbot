-- Gally (owner) and Naty (full_access) can read and write every task
-- and every chat. Admin still does not get that grant.

alter table public.profiles
  add column if not exists full_access boolean not null default false;

create or replace function public.has_full_access()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'owner' or full_access)
  );
$$;

revoke all on function public.has_full_access() from public;
grant execute on function public.has_full_access() to authenticated;

create or replace function public.is_chat_member(c uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    public.has_full_access()
    or exists (
      select 1 from public.chat_members
      where chat_id = c and user_id = auth.uid()
    );
$$;

drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks
  for select to authenticated
  using (
    owner_id = auth.uid()
    or assignee_id = auth.uid()
    or public.has_full_access()
    or (
      visibility = 'team'
      and public.is_team_member(team_id)
      and not public.has_role('guest')
    )
  );

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      public.has_full_access()
      or public.is_team_member(team_id)
    )
  );

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (
    public.has_full_access()
    or owner_id = auth.uid()
    or assignee_id = auth.uid()
    or (
      visibility = 'team'
      and public.is_team_member(team_id)
      and not public.has_role('guest')
    )
  )
  with check (
    public.has_full_access()
    or owner_id = auth.uid()
    or assignee_id = auth.uid()
    or (
      visibility = 'team'
      and public.is_team_member(team_id)
      and not public.has_role('guest')
    )
  );

update public.profiles
set full_access = true
where id = 'a0000000-0000-0000-0000-000000000002'
   or full_name ilike 'Natalia%'
   or full_name ilike 'Naty%';
