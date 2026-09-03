-- Work channels from the Equipo y Comunicación manual. New enum value
-- must land in its own migration so later statements can use it.

alter type public.chat_kind add value if not exists 'channel';
