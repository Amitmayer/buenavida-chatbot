-- P0-5: eight teams, twelve accounts, 25 realistic tasks.
-- Fixed UUIDs so rls.test.sql can assert exact counts.

-- pgcrypto lives in the extensions schema on local Supabase.
create extension if not exists pgcrypto with schema extensions;

create or replace function public.seed_auth_user(
  p_id uuid,
  p_email text,
  p_name text
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) values (
    '00000000-0000-0000-0000-000000000000',
    p_id,
    'authenticated',
    'authenticated',
    p_email,
    extensions.crypt('buenavida-dev', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_name),
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  on conflict (id) do nothing;

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    gen_random_uuid(),
    p_id,
    jsonb_build_object('sub', p_id::text, 'email', p_email),
    'email',
    p_id::text,
    now(),
    now(),
    now()
  )
  on conflict (provider, provider_id) do nothing;
end;
$$;

select public.seed_auth_user('a0000000-0000-0000-0000-000000000001', 'gally@buenavida.cr', 'Gally Mayer');
select public.seed_auth_user('a0000000-0000-0000-0000-000000000002', 'naty@buenavida.cr', 'Naty');
select public.seed_auth_user('a0000000-0000-0000-0000-000000000003', 'deybid@buenavida.cr', 'Deybid');
select public.seed_auth_user('a0000000-0000-0000-0000-000000000004', 'roy@buenavida.cr', 'Roy');
select public.seed_auth_user('a0000000-0000-0000-0000-000000000005', 'susana@buenavida.cr', 'Susana');
select public.seed_auth_user('a0000000-0000-0000-0000-000000000006', 'amanda@buenavida.cr', 'Amanda');
select public.seed_auth_user('a0000000-0000-0000-0000-000000000007', 'nathan@buenavida.cr', 'Nathan');
select public.seed_auth_user('a0000000-0000-0000-0000-000000000008', 'fernanda@buenavida.cr', 'Fernanda');
select public.seed_auth_user('a0000000-0000-0000-0000-000000000009', 'jenny@buenavida.cr', 'Jenny');
select public.seed_auth_user('a0000000-0000-0000-0000-00000000000a', 'angie@buenavida.cr', 'Angie');
select public.seed_auth_user('a0000000-0000-0000-0000-00000000000b', 'jhonny@buenavida.cr', 'Jhonny');
select public.seed_auth_user('a0000000-0000-0000-0000-00000000000c', 'david@buenavida.cr', 'David Mayer');

insert into public.teams (id, slug, name, areas) values
  ('b0000000-0000-0000-0000-000000000001', 'comercial', 'Comercial', array['pipeline', 'ruta', 'cotizaciones']),
  ('b0000000-0000-0000-0000-000000000002', 'operaciones', 'Operaciones', array['tueste', 'calidad', 'bodega', 'pedidos', 'envíos']),
  ('b0000000-0000-0000-0000-000000000003', 'usa', 'USA', '{}'),
  ('b0000000-0000-0000-0000-000000000004', 'academia', 'Academia', array['talleres', 'eventos']),
  ('b0000000-0000-0000-0000-000000000005', 'marketing', 'Marketing', array['diseño', 'redes', 'materiales']),
  ('b0000000-0000-0000-0000-000000000006', 'administracion', 'Administración', array['cobros', 'facturación', 'oficina']),
  ('b0000000-0000-0000-0000-000000000007', 'regenerativo', 'Regenerativo', '{}'),
  ('b0000000-0000-0000-0000-000000000008', 'direccion', 'Dirección', '{}')
on conflict (id) do nothing;

-- Gally first so reports_to FKs resolve.
update public.profiles set
  full_name = 'Gally Mayer',
  title = 'CEO, fundadora',
  role = 'owner',
  reports_to = null,
  default_team = 'b0000000-0000-0000-0000-000000000008'
where id = 'a0000000-0000-0000-0000-000000000001';

update public.profiles set
  full_name = 'Naty',
  title = 'Asistente de dirección',
  role = 'member',
  reports_to = 'a0000000-0000-0000-0000-000000000001',
  default_team = 'b0000000-0000-0000-0000-000000000008'
where id = 'a0000000-0000-0000-0000-000000000002';

update public.profiles set
  full_name = 'Deybid',
  title = 'Director comercial y RevOps',
  role = 'admin',
  reports_to = 'a0000000-0000-0000-0000-000000000001',
  default_team = 'b0000000-0000-0000-0000-000000000001'
where id = 'a0000000-0000-0000-0000-000000000003';

update public.profiles set
  full_name = 'Roy',
  title = 'Head barista, operaciones y ventas USA',
  role = 'member',
  reports_to = 'a0000000-0000-0000-0000-000000000001',
  default_team = 'b0000000-0000-0000-0000-000000000002'
where id = 'a0000000-0000-0000-0000-000000000004';

update public.profiles set
  full_name = 'Susana',
  title = 'Administración y finanzas',
  role = 'member',
  reports_to = 'a0000000-0000-0000-0000-000000000001',
  default_team = 'b0000000-0000-0000-0000-000000000006'
where id = 'a0000000-0000-0000-0000-000000000005';

update public.profiles set
  full_name = 'Amanda',
  title = 'Impacto regenerativo',
  role = 'member',
  reports_to = 'a0000000-0000-0000-0000-000000000001',
  default_team = 'b0000000-0000-0000-0000-000000000007'
where id = 'a0000000-0000-0000-0000-000000000006';

update public.profiles set
  full_name = 'Nathan',
  title = 'Ejecutivo comercial B2B',
  role = 'member',
  reports_to = 'a0000000-0000-0000-0000-000000000003',
  default_team = 'b0000000-0000-0000-0000-000000000001'
where id = 'a0000000-0000-0000-0000-000000000007';

update public.profiles set
  full_name = 'Fernanda',
  title = 'Academia y eventos',
  role = 'member',
  reports_to = 'a0000000-0000-0000-0000-000000000001',
  default_team = 'b0000000-0000-0000-0000-000000000004'
where id = 'a0000000-0000-0000-0000-000000000008';

update public.profiles set
  full_name = 'Jenny',
  title = 'Diseño gráfico y marketing',
  role = 'member',
  reports_to = 'a0000000-0000-0000-0000-000000000001',
  default_team = 'b0000000-0000-0000-0000-000000000005'
where id = 'a0000000-0000-0000-0000-000000000009';

update public.profiles set
  full_name = 'Angie',
  title = 'Tueste y control de calidad',
  role = 'member',
  reports_to = 'a0000000-0000-0000-0000-000000000004',
  default_team = 'b0000000-0000-0000-0000-000000000002'
where id = 'a0000000-0000-0000-0000-00000000000a';

update public.profiles set
  full_name = 'Jhonny',
  title = 'Bodega y logística CR',
  role = 'member',
  reports_to = 'a0000000-0000-0000-0000-000000000004',
  default_team = 'b0000000-0000-0000-0000-000000000002'
where id = 'a0000000-0000-0000-0000-00000000000b';

update public.profiles set
  full_name = 'David Mayer',
  title = 'Asesor estratégico externo',
  role = 'guest',
  reports_to = 'a0000000-0000-0000-0000-000000000001',
  default_team = 'b0000000-0000-0000-0000-000000000008'
where id = 'a0000000-0000-0000-0000-00000000000c';

insert into public.team_members (team_id, user_id, is_lead) values
  -- Comercial: Deybid (lead), Nathan, Roy, Naty
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', true),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000007', false),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', false),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', false),
  -- Operaciones: Roy (lead), Angie, Jhonny, Susana, Deybid, Nathan, Naty
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', true),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', false),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000b', false),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000005', false),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', false),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000007', false),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', false),
  -- USA: Roy (lead), Deybid, Naty
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004', true),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', false),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', false),
  -- Academia: Fernanda (lead), Deybid, Jenny, Naty
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000008', true),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000003', false),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000009', false),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', false),
  -- Marketing: Jenny (lead), Fernanda, Deybid, Naty
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000009', true),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000008', false),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000003', false),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', false),
  -- Administración: Susana (lead), Deybid, Naty
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000005', true),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', false),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002', false),
  -- Regenerativo: Amanda (lead), Naty
  ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000006', true),
  ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000002', false),
  -- Dirección: Gally (lead), Roy, Deybid, Naty, David (guest)
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', true),
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000004', false),
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000003', false),
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000002', false),
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-00000000000c', false)
on conflict do nothing;

-- 25 tasks. Dirección: 4 (one assigned to David, one restricted).
-- Operaciones: 6 (one assigned to Amanda, who is not on the team).
insert into public.tasks (
  id, title, notes, team_id, area, owner_id, assignee_id,
  due_date, priority, status, visibility, created_by
) values
  (
    'c0000000-0000-0000-0000-000000000001',
    'Modelo de precios Q4',
    'Revisar márgenes de especialidad vs comercial.',
    'b0000000-0000-0000-0000-000000000008', null,
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    ((timezone('America/Costa_Rica', now()))::date) + 10,
    'high', 'open', 'team',
    'a0000000-0000-0000-0000-000000000001'
  ),
  (
    'c0000000-0000-0000-0000-000000000002',
    'Términos de alianza SCA',
    'Borrador de partnership y cláusulas de marca.',
    'b0000000-0000-0000-0000-000000000008', null,
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000004',
    ((timezone('America/Costa_Rica', now()))::date) + 21,
    'medium', 'open', 'team',
    'a0000000-0000-0000-0000-000000000001'
  ),
  (
    'c0000000-0000-0000-0000-000000000003',
    'Revisión de tesis de inversión',
    'Comentarios de David sobre el memo para inversionistas.',
    'b0000000-0000-0000-0000-000000000008', null,
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-00000000000c',
    ((timezone('America/Costa_Rica', now()))::date) + 5,
    'high', 'open', 'team',
    'a0000000-0000-0000-0000-000000000001'
  ),
  (
    'c0000000-0000-0000-0000-000000000004',
    'Estrategia de pricing USA',
    'Solo Gally. No compartir con el equipo todavía.',
    'b0000000-0000-0000-0000-000000000008', null,
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    ((timezone('America/Costa_Rica', now()))::date) + 14,
    'urgent', 'open', 'restricted',
    'a0000000-0000-0000-0000-000000000001'
  ),
  (
    'c0000000-0000-0000-0000-000000000005',
    'Perfil de tueste lote Los Robles',
    'Cupping interno y ajuste de desarrollo.',
    'b0000000-0000-0000-0000-000000000002', 'tueste',
    'a0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-00000000000a',
    ((timezone('America/Costa_Rica', now()))::date) - 1,
    'high', 'in_progress', 'team',
    'a0000000-0000-0000-0000-000000000004'
  ),
  (
    'c0000000-0000-0000-0000-000000000006',
    'Inventario bodega Heredia',
    'Conteo de verde y empaque.',
    'b0000000-0000-0000-0000-000000000002', 'bodega',
    'a0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-00000000000b',
    ((timezone('America/Costa_Rica', now()))::date),
    'medium', 'open', 'team',
    'a0000000-0000-0000-0000-000000000004'
  ),
  (
    'c0000000-0000-0000-0000-000000000007',
    'Envío nacional CoopeTarrazú',
    'Confirmar transporte y guía.',
    'b0000000-0000-0000-0000-000000000002', 'envíos',
    'a0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-00000000000b',
    ((timezone('America/Costa_Rica', now()))::date) + 2,
    'high', 'open', 'team',
    'a0000000-0000-0000-0000-000000000004'
  ),
  (
    'c0000000-0000-0000-0000-000000000008',
    'Control de calidad lote 2408',
    'Humedad y defectos.',
    'b0000000-0000-0000-0000-000000000002', 'calidad',
    'a0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-00000000000a',
    ((timezone('America/Costa_Rica', now()))::date) + 1,
    'medium', 'open', 'team',
    'a0000000-0000-0000-0000-000000000004'
  ),
  (
    'c0000000-0000-0000-0000-000000000009',
    'Pedido de empaque compostable',
    'Amanda coordina el proveedor; no está en Operaciones.',
    'b0000000-0000-0000-0000-000000000002', 'pedidos',
    'a0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000006',
    ((timezone('America/Costa_Rica', now()))::date) + 4,
    'medium', 'open', 'team',
    'a0000000-0000-0000-0000-000000000004'
  ),
  (
    'c0000000-0000-0000-0000-00000000000a',
    'Calibración de tostadora',
    'Mantenimiento preventivo.',
    'b0000000-0000-0000-0000-000000000002', 'tueste',
    'a0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000004',
    ((timezone('America/Costa_Rica', now()))::date) + 8,
    'low', 'open', 'team',
    'a0000000-0000-0000-0000-000000000004'
  ),
  (
    'c0000000-0000-0000-0000-00000000000b',
    'Cotización Kracovia 40 kg',
    'Especialidad lavado, envío a San José.',
    'b0000000-0000-0000-0000-000000000001', 'cotizaciones',
    'a0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000007',
    ((timezone('America/Costa_Rica', now()))::date) - 3,
    'urgent', 'open', 'team',
    'a0000000-0000-0000-0000-000000000003'
  ),
  (
    'c0000000-0000-0000-0000-00000000000c',
    'Ruta Cartago jueves',
    'Visitas B2B y muestras.',
    'b0000000-0000-0000-0000-000000000001', 'ruta',
    'a0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000007',
    ((timezone('America/Costa_Rica', now()))::date) + 3,
    'high', 'open', 'team',
    'a0000000-0000-0000-0000-000000000003'
  ),
  (
    'c0000000-0000-0000-0000-00000000000d',
    'Seguimiento Café Don Juan',
    'Renovación de contrato anual.',
    'b0000000-0000-0000-0000-000000000001', 'pipeline',
    'a0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000003',
    ((timezone('America/Costa_Rica', now()))::date),
    'medium', 'in_progress', 'team',
    'a0000000-0000-0000-0000-000000000003'
  ),
  (
    'c0000000-0000-0000-0000-00000000000e',
    'Propuesta B2B hotel Nayara',
    'Volumen estimado 80 kg / mes.',
    'b0000000-0000-0000-0000-000000000001', 'pipeline',
    'a0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000007',
    ((timezone('America/Costa_Rica', now()))::date) + 6,
    'high', 'open', 'team',
    'a0000000-0000-0000-0000-000000000003'
  ),
  (
    'c0000000-0000-0000-0000-00000000000f',
    'Inventario warehouse Tennessee',
    'Cruce con exportes pendientes.',
    'b0000000-0000-0000-0000-000000000003', null,
    'a0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000004',
    ((timezone('America/Costa_Rica', now()))::date) - 2,
    'high', 'open', 'team',
    'a0000000-0000-0000-0000-000000000004'
  ),
  (
    'c0000000-0000-0000-0000-000000000010',
    'Exportación contenedor septiembre',
    'Documentos y booking.',
    'b0000000-0000-0000-0000-000000000003', null,
    'a0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000003',
    ((timezone('America/Costa_Rica', now()))::date) + 12,
    'urgent', 'open', 'team',
    'a0000000-0000-0000-0000-000000000004'
  ),
  (
    'c0000000-0000-0000-0000-000000000011',
    'Taller barista San José',
    'Cupos, aula y material.',
    'b0000000-0000-0000-0000-000000000004', 'talleres',
    'a0000000-0000-0000-0000-000000000008',
    'a0000000-0000-0000-0000-000000000008',
    ((timezone('America/Costa_Rica', now()))::date) + 9,
    'medium', 'open', 'team',
    'a0000000-0000-0000-0000-000000000008'
  ),
  (
    'c0000000-0000-0000-0000-000000000012',
    'Evento cupping SCA',
    'Lista de invitados y catación.',
    'b0000000-0000-0000-0000-000000000004', 'eventos',
    'a0000000-0000-0000-0000-000000000008',
    'a0000000-0000-0000-0000-000000000008',
    ((timezone('America/Costa_Rica', now()))::date) + 18,
    'low', 'open', 'team',
    'a0000000-0000-0000-0000-000000000008'
  ),
  (
    'c0000000-0000-0000-0000-000000000013',
    'Diseño etiqueta micro-lote',
    'Variedad geisha, cosecha 2026.',
    'b0000000-0000-0000-0000-000000000005', 'diseño',
    'a0000000-0000-0000-0000-000000000009',
    'a0000000-0000-0000-0000-000000000009',
    ((timezone('America/Costa_Rica', now()))::date) + 7,
    'high', 'in_progress', 'team',
    'a0000000-0000-0000-0000-000000000009'
  ),
  (
    'c0000000-0000-0000-0000-000000000014',
    'Carrusel Instagram cosecha',
    'Fotos de beneficio y finca.',
    'b0000000-0000-0000-0000-000000000005', 'redes',
    'a0000000-0000-0000-0000-000000000009',
    'a0000000-0000-0000-0000-000000000009',
    ((timezone('America/Costa_Rica', now()))::date) + 2,
    'medium', 'open', 'team',
    'a0000000-0000-0000-0000-000000000009'
  ),
  (
    'c0000000-0000-0000-0000-000000000015',
    'Cobro factura 1842',
    'Cliente 45 días vencido.',
    'b0000000-0000-0000-0000-000000000006', 'cobros',
    'a0000000-0000-0000-0000-000000000005',
    'a0000000-0000-0000-0000-000000000005',
    ((timezone('America/Costa_Rica', now()))::date) - 5,
    'urgent', 'open', 'team',
    'a0000000-0000-0000-0000-000000000005'
  ),
  (
    'c0000000-0000-0000-0000-000000000016',
    'Facturación mayorista agosto',
    'Cierre y XML.',
    'b0000000-0000-0000-0000-000000000006', 'facturación',
    'a0000000-0000-0000-0000-000000000005',
    'a0000000-0000-0000-0000-000000000005',
    ((timezone('America/Costa_Rica', now()))::date),
    'high', 'open', 'team',
    'a0000000-0000-0000-0000-000000000005'
  ),
  (
    'c0000000-0000-0000-0000-000000000017',
    'Inventario sistema oficina',
    'Cuadrar existencias con Bodega.',
    'b0000000-0000-0000-0000-000000000006', 'oficina',
    'a0000000-0000-0000-0000-000000000005',
    'a0000000-0000-0000-0000-000000000005',
    ((timezone('America/Costa_Rica', now()))::date) + 11,
    'low', 'open', 'team',
    'a0000000-0000-0000-0000-000000000005'
  ),
  (
    'c0000000-0000-0000-0000-000000000018',
    'Renovación certificación regenerativa',
    'Documentos y visita de auditoría.',
    'b0000000-0000-0000-0000-000000000007', null,
    'a0000000-0000-0000-0000-000000000006',
    'a0000000-0000-0000-0000-000000000006',
    ((timezone('America/Costa_Rica', now()))::date) + 30,
    'high', 'open', 'team',
    'a0000000-0000-0000-0000-000000000006'
  ),
  (
    'c0000000-0000-0000-0000-000000000019',
    'Alianza con finca La Amistad',
    'Acuerdo de compra 2026–2027.',
    'b0000000-0000-0000-0000-000000000007', null,
    'a0000000-0000-0000-0000-000000000006',
    'a0000000-0000-0000-0000-000000000006',
    ((timezone('America/Costa_Rica', now()))::date) + 16,
    'medium', 'open', 'team',
    'a0000000-0000-0000-0000-000000000006'
  )
on conflict (id) do nothing;

insert into public.task_events (task_id, actor_id, kind, diff, source)
select id, created_by, 'created', jsonb_build_object('title', title), 'ui'
from public.tasks
where not exists (
  select 1 from public.task_events e where e.task_id = tasks.id and e.kind = 'created'
);
