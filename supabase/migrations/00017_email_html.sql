alter table public.emails
  add column if not exists body_html text;
