-- Multiple people can be assigned to one task.
-- Access follows task_assignees (legacy tasks.assignee_id stays in sync as the first assignee).

create table if not exists public.task_assignees (
  task_id uuid not null references public.tasks on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create index if not exists task_assignees_user_idx on public.task_assignees (user_id);

insert into public.task_assignees (task_id, user_id)
select id, assignee_id
from public.tasks
where assignee_id is not null
on conflict do nothing;

create or replace function public.is_task_assignee(t uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.task_assignees
    where task_id = t and user_id = auth.uid()
  );
$$;

revoke all on function public.is_task_assignee(uuid) from public;
grant execute on function public.is_task_assignee(uuid) to authenticated;

alter table public.task_assignees enable row level security;

drop policy if exists task_assignees_select on public.task_assignees;
create policy task_assignees_select on public.task_assignees
  for select to authenticated
  using (
    exists (
      select 1 from public.tasks
      where id = task_id
    )
  );

drop policy if exists task_assignees_insert on public.task_assignees;
create policy task_assignees_insert on public.task_assignees
  for insert to authenticated
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_id
        and (
          public.has_full_access()
          or t.owner_id = auth.uid()
          or public.is_task_assignee(t.id)
          or (
            t.visibility = 'team'
            and public.is_team_member(t.team_id)
            and not public.has_role('guest')
          )
        )
    )
  );

drop policy if exists task_assignees_delete on public.task_assignees;
create policy task_assignees_delete on public.task_assignees
  for delete to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id
        and (
          public.has_full_access()
          or t.owner_id = auth.uid()
          or public.is_task_assignee(t.id)
          or (
            t.visibility = 'team'
            and public.is_team_member(t.team_id)
            and not public.has_role('guest')
          )
        )
    )
  );

drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks
  for select to authenticated
  using (
    owner_id = auth.uid()
    or public.is_task_assignee(id)
    or public.has_full_access()
    or (
      visibility = 'team'
      and public.is_team_member(team_id)
      and not public.has_role('guest')
    )
  );

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (
    public.has_full_access()
    or owner_id = auth.uid()
    or public.is_task_assignee(id)
    or (
      visibility = 'team'
      and public.is_team_member(team_id)
      and not public.has_role('guest')
    )
  )
  with check (
    public.has_full_access()
    or owner_id = auth.uid()
    or public.is_task_assignee(id)
    or (
      visibility = 'team'
      and public.is_team_member(team_id)
      and not public.has_role('guest')
    )
  );

create or replace function public.sync_task_assignees(p_task_id uuid, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  ids uuid[];
  primary_id uuid;
begin
  select coalesce(array_agg(u order by u), '{}'::uuid[])
  into ids
  from (
    select distinct x as u
    from unnest(coalesce(p_ids, '{}'::uuid[])) as x
    where x is not null
  ) s;

  if coalesce(array_length(ids, 1), 0) > 11 then
    raise exception 'too_many_assignees' using errcode = '22023';
  end if;

  delete from public.task_assignees where task_id = p_task_id;
  if coalesce(array_length(ids, 1), 0) > 0 then
    insert into public.task_assignees (task_id, user_id)
    select p_task_id, unnest(ids);
  end if;

  primary_id := ids[1];
  update public.tasks set assignee_id = primary_id where id = p_task_id;
end;
$$;

revoke all on function public.sync_task_assignees(uuid, uuid[]) from public;
grant execute on function public.sync_task_assignees(uuid, uuid[]) to authenticated;

drop function if exists public.create_task_with_event(
  text, text, uuid, text, uuid, uuid, date, public.task_priority, public.task_visibility, text, uuid
);

create or replace function public.create_task_with_event(
  p_title text,
  p_notes text,
  p_team_id uuid,
  p_area text,
  p_owner_id uuid,
  p_assignee_id uuid,
  p_due_date date,
  p_priority public.task_priority,
  p_visibility public.task_visibility,
  p_source text,
  p_project_id uuid default null,
  p_assignee_ids uuid[] default null
)
returns public.tasks
language plpgsql
security invoker
set search_path = public
as $$
declare
  t public.tasks;
  ids uuid[];
begin
  if p_project_id is not null then
    if not exists (
      select 1 from public.projects p
      where p.id = p_project_id
        and p.team_id = p_team_id
        and p.archived_at is null
    ) then
      raise exception 'invalid_project' using errcode = '22023';
    end if;
  end if;

  if p_assignee_ids is not null then
    ids := p_assignee_ids;
  elsif p_assignee_id is not null then
    ids := array[p_assignee_id];
  else
    ids := '{}'::uuid[];
  end if;

  insert into public.tasks (
    title, notes, team_id, area, owner_id, assignee_id,
    due_date, priority, visibility, created_by, status, project_id
  ) values (
    p_title,
    p_notes,
    p_team_id,
    p_area,
    p_owner_id,
    ids[1],
    p_due_date,
    coalesce(p_priority, 'medium'),
    coalesce(p_visibility, 'team'),
    auth.uid(),
    'open',
    p_project_id
  )
  returning * into t;

  perform public.sync_task_assignees(t.id, ids);

  insert into public.task_events (task_id, actor_id, kind, diff, source)
  values (
    t.id,
    auth.uid(),
    'created',
    jsonb_build_object(
      'title', t.title,
      'due_date', t.due_date,
      'assignee_id', t.assignee_id,
      'assignee_ids', to_jsonb(ids),
      'priority', t.priority,
      'project_id', t.project_id
    ),
    p_source
  );

  return t;
end;
$$;

create or replace function public.update_task_with_event(
  p_task_id uuid,
  p_patch jsonb,
  p_source text
)
returns public.tasks
language plpgsql
security invoker
set search_path = public
as $$
declare
  before public.tasks;
  after_row public.tasks;
  new_status public.task_status;
  new_team_id uuid;
  new_project_id uuid;
  kind text := 'updated';
  before_ids uuid[];
  after_ids uuid[];
  patch_ids uuid[];
begin
  select * into before from public.tasks where id = p_task_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(user_id order by user_id), '{}'::uuid[])
  into before_ids
  from public.task_assignees
  where task_id = p_task_id;

  new_status := coalesce((p_patch ->> 'status')::public.task_status, before.status);
  new_team_id := coalesce((p_patch ->> 'team_id')::uuid, before.team_id);
  new_project_id := case
    when p_patch ? 'project_id' and p_patch ->> 'project_id' is null then null
    when p_patch ? 'project_id' then (p_patch ->> 'project_id')::uuid
    else before.project_id
  end;

  if new_project_id is not null then
    if not exists (
      select 1 from public.projects p
      where p.id = new_project_id
        and p.team_id = new_team_id
        and p.archived_at is null
    ) then
      raise exception 'invalid_project' using errcode = '22023';
    end if;
  end if;

  update public.tasks set
    title = coalesce(p_patch ->> 'title', title),
    notes = case when p_patch ? 'notes' then p_patch ->> 'notes' else notes end,
    team_id = new_team_id,
    area = case when p_patch ? 'area' then p_patch ->> 'area' else area end,
    owner_id = coalesce((p_patch ->> 'owner_id')::uuid, owner_id),
    due_date = case
      when p_patch ? 'due_date' and p_patch ->> 'due_date' is null then null
      when p_patch ? 'due_date' then (p_patch ->> 'due_date')::date
      else due_date
    end,
    priority = coalesce((p_patch ->> 'priority')::public.task_priority, priority),
    visibility = coalesce((p_patch ->> 'visibility')::public.task_visibility, visibility),
    status = new_status,
    project_id = new_project_id,
    completed_at = case
      when new_status = 'done' and before.status is distinct from 'done' then now()
      when new_status is distinct from 'done' then null
      else completed_at
    end
  where id = p_task_id
  returning * into after_row;

  if p_patch ? 'assignee_ids' then
    if jsonb_typeof(p_patch -> 'assignee_ids') = 'array' then
      select coalesce(array_agg(value::uuid), '{}'::uuid[])
      into patch_ids
      from jsonb_array_elements_text(p_patch -> 'assignee_ids') as value
      where value is not null and value <> '';
    else
      patch_ids := '{}'::uuid[];
    end if;
    perform public.sync_task_assignees(p_task_id, patch_ids);
  elsif p_patch ? 'assignee_id' then
    if p_patch ->> 'assignee_id' is null or p_patch ->> 'assignee_id' = '' then
      perform public.sync_task_assignees(p_task_id, '{}'::uuid[]);
    else
      perform public.sync_task_assignees(p_task_id, array[(p_patch ->> 'assignee_id')::uuid]);
    end if;
  end if;

  select * into after_row from public.tasks where id = p_task_id;

  select coalesce(array_agg(user_id order by user_id), '{}'::uuid[])
  into after_ids
  from public.task_assignees
  where task_id = p_task_id;

  if before_ids is distinct from after_ids then
    kind := 'assigned';
  elsif new_status = 'done' and before.status is distinct from 'done' then
    kind := 'completed';
  elsif before.status = 'done' and new_status is distinct from 'done' then
    kind := 'reopened';
  end if;

  insert into public.task_events (task_id, actor_id, kind, diff, source)
  values (
    after_row.id,
    auth.uid(),
    kind,
    jsonb_build_object(
      'before', to_jsonb(before),
      'patch', p_patch,
      'assignee_ids_before', to_jsonb(before_ids),
      'assignee_ids_after', to_jsonb(after_ids)
    ),
    p_source
  );

  return after_row;
end;
$$;

revoke all on function public.create_task_with_event(
  text, text, uuid, text, uuid, uuid, date, public.task_priority, public.task_visibility, text, uuid, uuid[]
) from public;
revoke all on function public.update_task_with_event(uuid, jsonb, text) from public;
grant execute on function public.create_task_with_event(
  text, text, uuid, text, uuid, uuid, date, public.task_priority, public.task_visibility, text, uuid, uuid[]
) to authenticated;
grant execute on function public.update_task_with_event(uuid, jsonb, text) to authenticated;
