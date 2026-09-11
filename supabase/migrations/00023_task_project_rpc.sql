-- Allow create/update task RPCs to set project_id (must belong to the task's team).

drop function if exists public.create_task_with_event(
  text, text, uuid, text, uuid, uuid, date, public.task_priority, public.task_visibility, text
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
  p_project_id uuid default null
)
returns public.tasks
language plpgsql
security invoker
set search_path = public
as $$
declare
  t public.tasks;
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

  insert into public.tasks (
    title, notes, team_id, area, owner_id, assignee_id,
    due_date, priority, visibility, created_by, status, project_id
  ) values (
    p_title,
    p_notes,
    p_team_id,
    p_area,
    p_owner_id,
    p_assignee_id,
    p_due_date,
    coalesce(p_priority, 'medium'),
    coalesce(p_visibility, 'team'),
    auth.uid(),
    'open',
    p_project_id
  )
  returning * into t;

  insert into public.task_events (task_id, actor_id, kind, diff, source)
  values (
    t.id,
    auth.uid(),
    'created',
    jsonb_build_object(
      'title', t.title,
      'due_date', t.due_date,
      'assignee_id', t.assignee_id,
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
begin
  select * into before from public.tasks where id = p_task_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

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
    assignee_id = case
      when p_patch ? 'assignee_id' and p_patch ->> 'assignee_id' is null then null
      when p_patch ? 'assignee_id' then (p_patch ->> 'assignee_id')::uuid
      else assignee_id
    end,
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

  if p_patch ? 'assignee_id' and after_row.assignee_id is distinct from before.assignee_id then
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
    jsonb_build_object('before', to_jsonb(before), 'patch', p_patch),
    p_source
  );

  return after_row;
end;
$$;

revoke all on function public.create_task_with_event(
  text, text, uuid, text, uuid, uuid, date, public.task_priority, public.task_visibility, text, uuid
) from public;
revoke all on function public.update_task_with_event(uuid, jsonb, text) from public;
grant execute on function public.create_task_with_event(
  text, text, uuid, text, uuid, uuid, date, public.task_priority, public.task_visibility, text, uuid
) to authenticated;
grant execute on function public.update_task_with_event(uuid, jsonb, text) to authenticated;
