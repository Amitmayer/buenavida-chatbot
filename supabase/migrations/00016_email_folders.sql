alter table public.emails
  add column if not exists archived boolean not null default false,
  add column if not exists is_draft boolean not null default false;

create index if not exists emails_folder_idx
  on public.emails (user_id, is_draft, archived, inbound, occurred_at desc);
