-- Slack-style work channels. Membership is explicit (who is in the
-- channel), not inferred from team_members or from owner/admin.

alter table public.chats
  add column if not exists slug text,
  add column if not exists section text,
  add column if not exists purpose text,
  add column if not exists sort_order integer not null default 0;

alter table public.chats drop constraint if exists chats_channel_slug;
alter table public.chats
  add constraint chats_channel_slug unique (slug);

alter table public.chats drop constraint if exists chats_channel_shape;
alter table public.chats
  add constraint chats_channel_shape check (
    (kind = 'channel') = (slug is not null)
    and (
      section is null
      or section in ('strategic', 'ops', 'company')
    )
    and (
      kind <> 'channel'
      or section is not null
    )
  );

create table if not exists public.channel_files (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats on delete cascade,
  storage_path text not null unique,
  filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes <= 26214400),
  uploaded_by uuid not null references public.profiles,
  created_at timestamptz not null default now()
);

create index if not exists channel_files_chat_idx on public.channel_files (chat_id, created_at desc);

alter table public.channel_files enable row level security;

create policy channel_files_select on public.channel_files
  for select to authenticated
  using (
    public.is_chat_member(chat_id)
    and exists (
      select 1 from public.chats c
      where c.id = chat_id and c.kind = 'channel'
    )
  );

create policy channel_files_insert on public.channel_files
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and public.is_chat_member(chat_id)
    and exists (
      select 1 from public.chats c
      where c.id = chat_id and c.kind = 'channel'
    )
  );

create policy channel_files_delete on public.channel_files
  for delete to authenticated
  using (
    uploaded_by = auth.uid()
    or public.is_owner_or_admin()
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'channel-files',
  'channel-files',
  false,
  26214400,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv'
  ]
)
on conflict (id) do nothing;

-- Path: <chat_id>/<uuid>-<filename>
create policy channel_files_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'channel-files'
    and exists (
      select 1 from public.chats c
      where c.id::text = (storage.foldername(name))[1]
        and c.kind = 'channel'
        and public.is_chat_member(c.id)
    )
  );

create policy channel_files_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'channel-files'
    and exists (
      select 1 from public.chats c
      where c.id::text = (storage.foldername(name))[1]
        and c.kind = 'channel'
        and public.is_chat_member(c.id)
    )
  );

create policy channel_files_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'channel-files'
    and (
      owner = auth.uid()
      or public.is_owner_or_admin()
    )
  );

-- Company-wide channels pick up every new account.
create or replace function public.sync_company_channel_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.chat_members (chat_id, user_id)
  select c.id, new.id
  from public.chats c
  where c.kind = 'channel' and c.slug in ('general', 'bot-alertas')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_join_company_channels on public.profiles;
create trigger profiles_join_company_channels
  after insert on public.profiles
  for each row execute function public.sync_company_channel_member();

-- Channel membership is seeded, not self-serve. DMs and ad-hoc groups stay opt-in.
drop policy if exists chat_members_insert on public.chat_members;
create policy chat_members_insert on public.chat_members
  for insert to authenticated
  with check (
    exists (
      select 1 from public.chats
      where id = chat_id and kind in ('dm', 'group')
    )
    and (user_id = auth.uid() or public.is_chat_member(chat_id))
  );

-- Seed the fourteen channels from the 26/08/2026 manual.
insert into public.chats (id, kind, slug, title, section, purpose, sort_order) values
  (
    'c0000000-0000-0000-0000-000000000001',
    'channel',
    'ventas-cr',
    'Ventas CR',
    'strategic',
    'Pipeline de CR visible sin preguntar.',
    1
  ),
  (
    'c0000000-0000-0000-0000-000000000002',
    'channel',
    'estrategia',
    'Estrategia',
    'strategic',
    'Temas con David o decisiones que necesitan perspectiva externa.',
    2
  ),
  (
    'c0000000-0000-0000-0000-000000000003',
    'channel',
    'academia',
    'Academia',
    'strategic',
    'Pipeline de academia visible. Fernanda coordina acá.',
    3
  ),
  (
    'c0000000-0000-0000-0000-000000000004',
    'channel',
    'usa',
    'USA',
    'strategic',
    'Operación USA visible en tiempo real.',
    4
  ),
  (
    'c0000000-0000-0000-0000-000000000005',
    'channel',
    'admin',
    'Admin',
    'strategic',
    'Cobros y cuentas trazadas.',
    5
  ),
  (
    'c0000000-0000-0000-0000-000000000006',
    'channel',
    'regenerativo',
    'Regenerativo',
    'strategic',
    'Amanda documenta avances; Gally aprueba o redirige.',
    6
  ),
  (
    'c0000000-0000-0000-0000-000000000007',
    'channel',
    'ruta-comercial',
    'Ruta comercial',
    'ops',
    'Nathan reporta su ruta diaria. Deybid tiene visibilidad sin preguntar.',
    7
  ),
  (
    'c0000000-0000-0000-0000-000000000008',
    'channel',
    'pedidos',
    'Pedidos',
    'ops',
    'El pedido entra, se despacha y se factura en el mismo canal.',
    8
  ),
  (
    'c0000000-0000-0000-0000-000000000009',
    'channel',
    'cotizaciones',
    'Cotizaciones',
    'ops',
    'Toda cotización queda registrada con fecha.',
    9
  ),
  (
    'c0000000-0000-0000-0000-00000000000a',
    'channel',
    'operaciones',
    'Operaciones',
    'ops',
    'Roy coordina tueste y bodega. Susana actualiza inventarios.',
    10
  ),
  (
    'c0000000-0000-0000-0000-00000000000b',
    'channel',
    'logistica',
    'Logística',
    'ops',
    'Todo movimiento de carga trazado antes de que el cliente llame.',
    11
  ),
  (
    'c0000000-0000-0000-0000-00000000000c',
    'channel',
    'marketing',
    'Marketing',
    'ops',
    'Deybid orienta, Jenny ejecuta, Fernanda sincroniza tiempos.',
    12
  ),
  (
    'c0000000-0000-0000-0000-00000000000d',
    'channel',
    'general',
    'General',
    'company',
    'Solo anuncios que le importan a toda la empresa.',
    13
  ),
  (
    'c0000000-0000-0000-0000-00000000000e',
    'channel',
    'bot-alertas',
    'Cuellos de botella',
    'company',
    'El equipo actúa sobre alertas, no las busca.',
    14
  )
on conflict (id) do nothing;

-- Membership from the manual. Skip rows until those profiles exist
-- (production is provisioned later; local seed creates the twelve accounts).
insert into public.chat_members (chat_id, user_id)
select v.chat_id, v.user_id
from (
  values
    ('c0000000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid),
    ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004'),
    ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003'),
    ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001'),
    ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004'),
    ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003'),
    ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000c'),
    ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001'),
    ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000008'),
    ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003'),
    ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001'),
    ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004'),
    ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000003'),
    ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001'),
    ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005'),
    ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000003'),
    ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001'),
    ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006'),
    ('c0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000003'),
    ('c0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000007'),
    ('c0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000004'),
    ('c0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000003'),
    ('c0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000007'),
    ('c0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000004'),
    ('c0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000005'),
    ('c0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-00000000000b'),
    ('c0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000003'),
    ('c0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000007'),
    ('c0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000004'),
    ('c0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000005'),
    ('c0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000004'),
    ('c0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-00000000000a'),
    ('c0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000005'),
    ('c0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-00000000000b'),
    ('c0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000004'),
    ('c0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000b'),
    ('c0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000003'),
    ('c0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000005'),
    ('c0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-000000000009'),
    ('c0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-000000000008'),
    ('c0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-000000000003')
) as v(chat_id, user_id)
join public.profiles p on p.id = v.user_id
on conflict do nothing;

insert into public.chat_members (chat_id, user_id)
select c.id, p.id
from public.chats c
cross join public.profiles p
where c.kind = 'channel' and c.slug in ('general', 'bot-alertas')
on conflict do nothing;
