-- Eight company teams. Local seed.sql uses the same ids with ON CONFLICT DO NOTHING.

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

insert into public.chats (kind, team_id, title)
select 'team', id, name from public.teams
on conflict (team_id) do nothing;
