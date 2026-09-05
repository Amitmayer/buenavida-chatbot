-- Per-user Gmail connect. Tokens are encrypted in app code before insert.
-- One person sees only their own mail. full_access does not apply.

create table public.email_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null default 'gmail',
  email text not null,
  refresh_token_enc text not null,
  access_token_enc text,
  access_expires_at timestamptz,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table public.emails (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.email_accounts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  gmail_id text not null,
  thread_id text not null,
  rfc_message_id text,
  from_address text not null,
  to_addresses text[] not null default '{}',
  subject text not null default '',
  snippet text not null default '',
  body_text text not null default '',
  occurred_at timestamptz not null,
  unread boolean not null default false,
  inbound boolean not null default true,
  summary text,
  draft_reply text,
  task_id uuid references public.tasks (id),
  created_at timestamptz not null default now(),
  unique (account_id, gmail_id)
);

create index emails_user_occurred_idx on public.emails (user_id, occurred_at desc);
create index emails_thread_idx on public.emails (user_id, thread_id);

alter table public.email_accounts enable row level security;
alter table public.emails enable row level security;

create policy email_accounts_all on public.email_accounts
  for all to authenticated
  using (user_id = auth.uid() and not public.has_role('guest'))
  with check (user_id = auth.uid() and not public.has_role('guest'));

create policy emails_all on public.emails
  for all to authenticated
  using (user_id = auth.uid() and not public.has_role('guest'))
  with check (user_id = auth.uid() and not public.has_role('guest'));
