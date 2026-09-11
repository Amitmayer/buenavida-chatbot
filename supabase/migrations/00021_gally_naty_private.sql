-- Private area for Gally and Naty only.
-- Membership is the sole access path: owner / full_access / admin do NOT bypass.

alter table public.teams
  add column if not exists is_private boolean not null default false;

create or replace function public.is_private_team(t uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select is_private from public.teams where id = t),
    false
  );
$$;

revoke all on function public.is_private_team(uuid) from public;
grant execute on function public.is_private_team(uuid) to authenticated;

-- Keep is_private from being cleared by clients.
create or replace function public.guard_private_team()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.is_private and not new.is_private then
    raise exception 'private teams cannot become public';
  end if;
  return new;
end;
$$;

drop trigger if exists teams_guard_private on public.teams;
create trigger teams_guard_private
  before update of is_private on public.teams
  for each row execute function public.guard_private_team();

-- Assignees/owners on private-team tasks must be members.
create or replace function public.enforce_private_team_people()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_private_team(new.team_id) then
    return new;
  end if;
  if not exists (
    select 1 from public.team_members
    where team_id = new.team_id and user_id = new.owner_id
  ) then
    raise exception 'private team task owner must be a member';
  end if;
  if new.assignee_id is not null and not exists (
    select 1 from public.team_members
    where team_id = new.team_id and user_id = new.assignee_id
  ) then
    raise exception 'private team task assignee must be a member';
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_enforce_private_people on public.tasks;
create trigger tasks_enforce_private_people
  before insert or update of team_id, owner_id, assignee_id on public.tasks
  for each row execute function public.enforce_private_team_people();

-- Teams: private rows only visible to members.
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams
  for select to authenticated
  using (
    not is_private
    or public.is_team_member(id)
  );

drop policy if exists teams_update on public.teams;
create policy teams_update on public.teams
  for update to authenticated
  using (
    (is_private and public.is_team_member(id))
    or (not is_private and public.is_owner_or_admin())
  )
  with check (
    (is_private and public.is_team_member(id))
    or (not is_private and public.is_owner_or_admin())
  );

-- Membership of a private team is managed only by existing members.
-- Bootstrap memberships are inserted by this migration (table owner bypasses RLS).
drop policy if exists team_members_select on public.team_members;
create policy team_members_select on public.team_members
  for select to authenticated
  using (
    not public.is_private_team(team_id)
    or public.is_team_member(team_id)
  );

drop policy if exists team_members_insert on public.team_members;
create policy team_members_insert on public.team_members
  for insert to authenticated
  with check (
    (
      public.is_private_team(team_id)
      and public.is_team_member(team_id)
    )
    or (
      not public.is_private_team(team_id)
      and public.is_owner_or_admin()
    )
  );

drop policy if exists team_members_update on public.team_members;
create policy team_members_update on public.team_members
  for update to authenticated
  using (
    (
      public.is_private_team(team_id)
      and public.is_team_member(team_id)
    )
    or (
      not public.is_private_team(team_id)
      and public.is_owner_or_admin()
    )
  )
  with check (
    (
      public.is_private_team(team_id)
      and public.is_team_member(team_id)
    )
    or (
      not public.is_private_team(team_id)
      and public.is_owner_or_admin()
    )
  );

drop policy if exists team_members_delete on public.team_members;
create policy team_members_delete on public.team_members
  for delete to authenticated
  using (
    (
      public.is_private_team(team_id)
      and public.is_team_member(team_id)
    )
    or (
      not public.is_private_team(team_id)
      and public.is_owner_or_admin()
    )
  );

-- Tasks: full_access / owner role never pierce a private team.
drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks
  for select to authenticated
  using (
    (
      public.is_private_team(team_id)
      and public.is_team_member(team_id)
    )
    or (
      not public.is_private_team(team_id)
      and (
        owner_id = auth.uid()
        or assignee_id = auth.uid()
        or public.has_full_access()
        or (
          visibility = 'team'
          and public.is_team_member(team_id)
          and not public.has_role('guest')
        )
      )
    )
  );

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      (
        public.is_private_team(team_id)
        and public.is_team_member(team_id)
      )
      or (
        not public.is_private_team(team_id)
        and (
          public.has_full_access()
          or public.is_team_member(team_id)
        )
      )
    )
  );

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (
    (
      public.is_private_team(team_id)
      and public.is_team_member(team_id)
    )
    or (
      not public.is_private_team(team_id)
      and (
        public.has_full_access()
        or owner_id = auth.uid()
        or assignee_id = auth.uid()
        or (
          visibility = 'team'
          and public.is_team_member(team_id)
          and not public.has_role('guest')
        )
      )
    )
  )
  with check (
    (
      public.is_private_team(team_id)
      and public.is_team_member(team_id)
    )
    or (
      not public.is_private_team(team_id)
      and (
        public.has_full_access()
        or owner_id = auth.uid()
        or assignee_id = auth.uid()
        or (
          visibility = 'team'
          and public.is_team_member(team_id)
          and not public.has_role('guest')
        )
      )
    )
  );

-- Attachments: admin delete must not pierce private-team files.
drop policy if exists attachments_delete on public.attachments;
create policy attachments_delete on public.attachments
  for delete to authenticated
  using (
    uploaded_by = auth.uid()
    or (
      public.is_owner_or_admin()
      and exists (
        select 1
        from public.tasks t
        where t.id = task_id
          and (
            not public.is_private_team(t.team_id)
            or public.is_team_member(t.team_id)
          )
      )
    )
  );

-- Chat: full_access must not open private-team rooms.
create or replace function public.is_chat_member(c uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    exists (
      select 1 from public.chat_members
      where chat_id = c and user_id = auth.uid()
    )
    or (
      public.has_full_access()
      and not exists (
        select 1
        from public.chats ch
        join public.teams t on t.id = ch.team_id
        where ch.id = c
          and t.is_private
      )
    );
$$;

-- Seed the private area. Fixed id so app code and tests can refer to it.
insert into public.teams (id, slug, name, areas, is_private)
values (
  'b0000000-0000-0000-0000-000000000009',
  'gally-naty',
  'Gally y Naty',
  '{}',
  true
)
on conflict (id) do update
set
  slug = excluded.slug,
  name = excluded.name,
  is_private = true;

-- Gally + Naty only. Table owner bypasses RLS for this bootstrap.
insert into public.team_members (team_id, user_id, is_lead)
values
  ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', true),
  ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000002', false)
on conflict (team_id, user_id) do nothing;

-- Ensure team chat membership for both (trigger may have run on insert).
insert into public.chat_members (chat_id, user_id)
select c.id, tm.user_id
from public.chats c
join public.team_members tm on tm.team_id = c.team_id
where c.team_id = 'b0000000-0000-0000-0000-000000000009'
  and c.kind = 'team'
on conflict do nothing;
