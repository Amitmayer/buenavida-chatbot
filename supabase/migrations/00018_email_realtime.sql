alter table public.emails replica identity full;
alter publication supabase_realtime add table public.emails;
