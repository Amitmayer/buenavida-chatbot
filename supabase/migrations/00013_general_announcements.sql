-- General is the company announcement board. The assistant can attach a task
-- and mark the post as coming from the bot. Guests stay out.

alter table public.chat_messages
  add column if not exists via_assistant boolean not null default false;

alter table public.chat_messages
  add column if not exists task_id uuid references public.tasks on delete set null;

create index if not exists chat_messages_task_idx
  on public.chat_messages (task_id)
  where task_id is not null;

update public.chats
set
  title = 'Anuncios',
  purpose = 'Novedades de toda la empresa. El asistente publica acá avisos y tareas importantes.'
where kind = 'channel' and slug = 'general';

create or replace function public.sync_company_channel_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'guest' then
    return new;
  end if;
  insert into public.chat_members (chat_id, user_id)
  select c.id, new.id
  from public.chats c
  where c.kind = 'channel' and c.slug in ('general', 'bot-alertas')
  on conflict do nothing;
  return new;
end;
$$;

delete from public.chat_members cm
using public.profiles p, public.chats c
where cm.user_id = p.id
  and cm.chat_id = c.id
  and p.role = 'guest'
  and c.kind = 'channel'
  and c.slug in ('general', 'bot-alertas');

insert into public.chat_members (chat_id, user_id)
select c.id, p.id
from public.chats c
cross join public.profiles p
where c.kind = 'channel'
  and c.slug in ('general', 'bot-alertas')
  and p.role <> 'guest'
on conflict do nothing;
