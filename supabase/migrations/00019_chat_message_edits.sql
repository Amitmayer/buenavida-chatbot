-- Edit and soft-delete of chat messages. Only the sender can change a row.

alter table public.chat_messages
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;

create policy chat_messages_update on public.chat_messages
  for update to authenticated
  using (sender_id = auth.uid() and public.is_chat_member(chat_id))
  with check (sender_id = auth.uid() and public.is_chat_member(chat_id));
