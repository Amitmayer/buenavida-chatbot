-- People-to-people messaging. Distinct from assistant conversations.
-- Team rooms exclude guests. DMs and explicit groups are opt-in.

create type public.chat_kind as enum ('dm', 'team', 'group');

create table public.chats (
  id uuid primary key default gen_random_uuid(),
  kind public.chat_kind not null,
  team_id uuid references public.teams on delete cascade,
  title text,
  dm_key text unique,
  created_by uuid references public.profiles,
  created_at timestamptz not null default now(),
  constraint team_chat_has_team check (
    (kind = 'team') = (team_id is not null)
  ),
  constraint dm_has_key check (
    (kind = 'dm') = (dm_key is not null)
  ),
  constraint chats_team_id_unique unique (team_id)
);

create table public.chat_members (
  chat_id uuid not null references public.chats on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);

create index chat_members_user_idx on public.chat_members (user_id);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats on delete cascade,
  sender_id uuid not null references public.profiles,
  content text not null check (length(trim(content)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index chat_messages_chat_created_idx
  on public.chat_messages (chat_id, created_at desc);

create or replace function public.is_chat_member(c uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.chat_members
    where chat_id = c and user_id = auth.uid()
  );
$$;

revoke all on function public.is_chat_member(uuid) from public;
grant execute on function public.is_chat_member(uuid) to authenticated;

alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.chat_messages enable row level security;

create policy chats_select on public.chats
  for select to authenticated
  using (public.is_chat_member(id));

create policy chats_insert on public.chats
  for insert to authenticated
  with check (created_by = auth.uid() and kind in ('dm', 'group'));

create policy chat_members_select on public.chat_members
  for select to authenticated
  using (public.is_chat_member(chat_id) or user_id = auth.uid());

create policy chat_members_insert on public.chat_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    or public.is_chat_member(chat_id)
  );

create policy chat_members_update on public.chat_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy chat_messages_select on public.chat_messages
  for select to authenticated
  using (public.is_chat_member(chat_id));

create policy chat_messages_insert on public.chat_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_chat_member(chat_id)
  );

-- Team room: one chat per team. Guests never join automatically.
create or replace function public.ensure_team_chat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.chats (kind, team_id, title, created_by)
  values ('team', new.id, new.name, null)
  on conflict (team_id) do nothing;
  return new;
end;
$$;

create trigger teams_ensure_chat
  after insert on public.teams
  for each row execute function public.ensure_team_chat();

create or replace function public.sync_team_chat_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  room uuid;
  member_role public.user_role;
begin
  if tg_op = 'INSERT' then
    select id into room from public.chats where team_id = new.team_id and kind = 'team';
    if room is null then
      return new;
    end if;
    select role into member_role from public.profiles where id = new.user_id;
    if member_role is distinct from 'guest' then
      insert into public.chat_members (chat_id, user_id)
      values (room, new.user_id)
      on conflict do nothing;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    select id into room from public.chats where team_id = old.team_id and kind = 'team';
    if room is not null then
      delete from public.chat_members
      where chat_id = room and user_id = old.user_id;
    end if;
    return old;
  end if;
  return null;
end;
$$;

create trigger team_members_sync_chat
  after insert or delete on public.team_members
  for each row execute function public.sync_team_chat_member();

-- If a guest becomes a member, add them to their team rooms.
create or replace function public.sync_chat_on_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'guest' and new.role is distinct from 'guest' then
    insert into public.chat_members (chat_id, user_id)
    select c.id, new.id
    from public.team_members tm
    join public.chats c on c.team_id = tm.team_id and c.kind = 'team'
    where tm.user_id = new.id
    on conflict do nothing;
  end if;
  if new.role = 'guest' and old.role is distinct from 'guest' then
    delete from public.chat_members cm
    using public.chats c
    where cm.chat_id = c.id
      and cm.user_id = new.id
      and c.kind = 'team';
  end if;
  return new;
end;
$$;

create trigger profiles_sync_chat_role
  after update of role on public.profiles
  for each row execute function public.sync_chat_on_role_change();

create or replace function public.open_or_get_dm(p_other uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  key text;
  room uuid;
begin
  if me is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_other is null or p_other = me then
    raise exception 'invalid other user' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_other) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  key := least(me::text, p_other::text) || ':' || greatest(me::text, p_other::text);

  select id into room from public.chats where dm_key = key;
  if room is not null then
    insert into public.chat_members (chat_id, user_id)
    values (room, me), (room, p_other)
    on conflict do nothing;
    return room;
  end if;

  insert into public.chats (kind, dm_key, created_by)
  values ('dm', key, me)
  returning id into room;

  insert into public.chat_members (chat_id, user_id)
  values (room, me), (room, p_other);

  return room;
end;
$$;

revoke all on function public.open_or_get_dm(uuid) from public;
grant execute on function public.open_or_get_dm(uuid) to authenticated;

create or replace function public.create_group_chat(p_title text, p_member_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  room uuid;
  member uuid;
begin
  if me is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if length(trim(p_title)) < 1 then
    raise exception 'validation' using errcode = '22023';
  end if;

  insert into public.chats (kind, title, created_by)
  values ('group', trim(p_title), me)
  returning id into room;

  insert into public.chat_members (chat_id, user_id) values (room, me);

  if p_member_ids is not null then
    foreach member in array p_member_ids loop
      if member is distinct from me and exists (select 1 from public.profiles where id = member) then
        insert into public.chat_members (chat_id, user_id)
        values (room, member)
        on conflict do nothing;
      end if;
    end loop;
  end if;

  return room;
end;
$$;

revoke all on function public.create_group_chat(text, uuid[]) from public;
grant execute on function public.create_group_chat(text, uuid[]) to authenticated;

-- Existing teams (already seeded) get a room; new teams are handled by the trigger.
insert into public.chats (kind, team_id, title)
select 'team', id, name from public.teams
on conflict (team_id) do nothing;

insert into public.chat_members (chat_id, user_id)
select c.id, tm.user_id
from public.team_members tm
join public.chats c on c.team_id = tm.team_id and c.kind = 'team'
join public.profiles p on p.id = tm.user_id
where p.role is distinct from 'guest'
on conflict do nothing;

alter table public.chat_messages replica identity full;
alter publication supabase_realtime add table public.chat_messages;
