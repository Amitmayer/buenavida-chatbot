-- P0-1: enums, profiles, teams, team_members.

create type public.user_role as enum ('owner', 'admin', 'member', 'guest');
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.task_status as enum ('open', 'in_progress', 'done', 'cancelled');
create type public.task_visibility as enum ('team', 'restricted');

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  title text,
  role public.user_role not null default 'member',
  reports_to uuid references public.profiles,
  default_team uuid,
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  areas text[] not null default '{}'
);

alter table public.profiles
  add constraint profiles_default_team_fkey
  foreign key (default_team) references public.teams;

create table public.team_members (
  team_id uuid references public.teams on delete cascade,
  user_id uuid references public.profiles on delete cascade,
  is_lead boolean not null default false,
  primary key (team_id, user_id)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    'member'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
