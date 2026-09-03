-- P0-2: tasks, task_events, attachments.

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 200),
  notes text,
  team_id uuid not null references public.teams,
  area text,
  owner_id uuid not null references public.profiles,
  assignee_id uuid references public.profiles,
  due_date date,
  priority public.task_priority not null default 'medium',
  status public.task_status not null default 'open',
  visibility public.task_visibility not null default 'team',
  created_by uuid not null references public.profiles,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint done_has_timestamp
    check ((status = 'done') = (completed_at is not null))
);

create index tasks_team_status_due_idx on public.tasks (team_id, status, due_date);
create index tasks_assignee_status_idx on public.tasks (assignee_id, status);
create index tasks_owner_status_idx on public.tasks (owner_id, status);

create table public.task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks on delete cascade,
  actor_id uuid not null references public.profiles,
  kind text not null,
  diff jsonb not null default '{}',
  source text not null,
  created_at timestamptz not null default now()
);

create index task_events_task_created_idx on public.task_events (task_id, created_at desc);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks on delete cascade,
  storage_path text not null unique,
  filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes <= 26214400),
  uploaded_by uuid not null references public.profiles,
  created_at timestamptz not null default now()
);

create index attachments_task_idx on public.attachments (task_id);
