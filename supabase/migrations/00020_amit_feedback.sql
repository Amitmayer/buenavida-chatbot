-- Company-wide group for feedback and errors. Every account is a member.

insert into public.chats (id, kind, title, created_by)
values (
  'e0000000-0000-0000-0000-000000000001',
  'group',
  'Amit Feedback',
  null
)
on conflict (id) do nothing;

insert into public.chat_members (chat_id, user_id)
select 'e0000000-0000-0000-0000-000000000001', id
from public.profiles
on conflict do nothing;

create or replace function public.sync_feedback_chat_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.chat_members (chat_id, user_id)
  values ('e0000000-0000-0000-0000-000000000001', new.id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_join_feedback_chat on public.profiles;
create trigger profiles_join_feedback_chat
  after insert on public.profiles
  for each row execute function public.sync_feedback_chat_member();
