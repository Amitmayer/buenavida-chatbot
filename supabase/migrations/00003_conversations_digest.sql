-- P0-3: conversations, messages, tool_calls, digest_runs.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  title text,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  client_message_id text,
  created_at timestamptz not null default now()
);

create unique index messages_conversation_client_message_id_idx
  on public.messages (conversation_id, client_message_id)
  where client_message_id is not null;

create table public.tool_calls (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages on delete cascade,
  name text not null,
  input jsonb not null,
  status text not null check (status in ('pending', 'ok', 'error')),
  result jsonb,
  error_code text,
  task_id uuid references public.tasks on delete set null,
  created_at timestamptz not null default now()
);

create table public.digest_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles,
  run_date date not null,
  status text not null,
  detail text,
  created_at timestamptz not null default now(),
  unique (user_id, run_date)
);
