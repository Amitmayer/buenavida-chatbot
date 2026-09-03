-- Local demo data so the logged-in extra profile can see Áreas, Hoy, Tareas, and Archivos.
-- Not a migration: do not apply this in production.

do $$
declare
  demo uuid;
  today date := (timezone('America/Costa_Rica', now()))::date;
begin
  select id into demo
  from public.profiles
  where id not in (
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000005',
    'a0000000-0000-0000-0000-000000000006',
    'a0000000-0000-0000-0000-000000000007',
    'a0000000-0000-0000-0000-000000000008',
    'a0000000-0000-0000-0000-000000000009',
    'a0000000-0000-0000-0000-00000000000a',
    'a0000000-0000-0000-0000-00000000000b',
    'a0000000-0000-0000-0000-00000000000c'
  )
  order by created_at
  limit 1;

  if demo is null then
    raise notice 'No extra profile to attach demo data to.';
    return;
  end if;

  insert into public.team_members (team_id, user_id, is_lead)
  select t.id, demo, false
  from public.teams t
  on conflict do nothing;

  update public.profiles
  set default_team = 'b0000000-0000-0000-0000-000000000001'
  where id = demo and default_team is null;

  insert into public.chat_members (chat_id, user_id)
  select c.id, demo
  from public.chats c
  where c.kind = 'channel'
  on conflict do nothing;

  insert into public.tasks (
    id, title, notes, team_id, area, owner_id, assignee_id,
    due_date, priority, status, visibility, created_by
  )
  values
    (
      'd1000000-0000-0000-0000-000000000001',
      'Enviar cotización a Hotel Nayara — 40 kg',
      'Placeholder para ver una tarea atrasada.',
      'b0000000-0000-0000-0000-000000000001', 'mayoreo',
      'a0000000-0000-0000-0000-000000000003', demo,
      today - 1, 'high', 'open', 'team', demo
    ),
    (
      'd1000000-0000-0000-0000-000000000002',
      'Confirmar envío mayorista a Café Kalú',
      'Placeholder para hoy.',
      'b0000000-0000-0000-0000-000000000001', 'mayoreo',
      'a0000000-0000-0000-0000-000000000003', demo,
      today, 'medium', 'open', 'team', demo
    ),
    (
      'd1000000-0000-0000-0000-000000000003',
      'Cupping de Las Lajas Washed',
      'Placeholder para esta semana.',
      'b0000000-0000-0000-0000-000000000002', 'calidad',
      'a0000000-0000-0000-0000-00000000000a', demo,
      today + 1, 'medium', 'open', 'team', demo
    ),
    (
      'd1000000-0000-0000-0000-000000000004',
      'Curso de barista — confirmar 12 cupos',
      'Placeholder de Academia.',
      'b0000000-0000-0000-0000-000000000004', 'cursos',
      'a0000000-0000-0000-0000-000000000008', demo,
      today + 4, 'low', 'open', 'team', demo
    ),
    (
      'd1000000-0000-0000-0000-000000000005',
      'Subir análisis de suelo de Finca Sonora',
      'Sin fecha, asignada a vos.',
      'b0000000-0000-0000-0000-000000000007', 'fincas',
      'a0000000-0000-0000-0000-000000000006', demo,
      null, 'medium', 'open', 'team', demo
    ),
    (
      'd1000000-0000-0000-0000-000000000006',
      'Reponer molienda en barra del restaurante',
      'Placeholder de Operaciones.',
      'b0000000-0000-0000-0000-000000000002', 'barra',
      'a0000000-0000-0000-0000-000000000004', demo,
      today + 8, 'low', 'open', 'team', demo
    )
  on conflict (id) do nothing;

  insert into public.brand_files (
    storage_path, filename, mime_type, size_bytes, folder, uploaded_by
  )
  values
    ('demo/manual-marca.pdf', 'Manual de marca Buena Vida v3.pdf', 'application/pdf', 4404019, 'general', 'a0000000-0000-0000-0000-000000000001'),
    ('demo/logo-verde.png', 'Logo Buena Vida — fondo verde.png', 'image/png', 839680, 'general', 'a0000000-0000-0000-0000-000000000001'),
    ('demo/trazabilidad.xlsx', 'Trazabilidad seed-to-cup 2026.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 1153433, 'general', 'a0000000-0000-0000-0000-000000000001'),
    ('demo/cupping-lajas.pdf', 'Cupping Las Lajas Washed — 84.5.pdf', 'application/pdf', 317440, 'general', 'a0000000-0000-0000-0000-000000000001'),
    ('demo/suelo-sonora.pdf', 'Análisis de suelo Finca Sonora.pdf', 'application/pdf', 2831155, 'general', 'a0000000-0000-0000-0000-000000000001'),
    ('demo/brumas.jpg', 'Foto finca Brumas del Zurquí.jpg', 'image/jpeg', 5662310, 'general', 'a0000000-0000-0000-0000-000000000001'),
    ('demo/contrato-kalu.docx', 'Contrato mayoreo Café Kalú.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 184320, 'general', 'a0000000-0000-0000-0000-000000000001'),
    ('demo/cert-regenerativa.pdf', 'Certificación regenerativa 2026.pdf', 'application/pdf', 921600, 'general', 'a0000000-0000-0000-0000-000000000001')
  on conflict (storage_path) do nothing;

  insert into public.channel_files (
    chat_id, storage_path, filename, mime_type, size_bytes, uploaded_by
  )
  values
    (
      'c0000000-0000-0000-0000-00000000000d',
      'demo/general/anuncio-semana.pdf',
      'Anuncio de la semana.pdf',
      'application/pdf',
      245760,
      demo
    ),
    (
      'c0000000-0000-0000-0000-00000000000e',
      'demo/alertas/cuello-embotellado.png',
      'Foto cuello de botella — empaque.png',
      'image/png',
      512000,
      demo
    ),
    (
      'c0000000-0000-0000-0000-00000000000a',
      'demo/ops/lote-240-tueste.pdf',
      'Perfil de tueste lote 240.pdf',
      'application/pdf',
      390000,
      demo
    )
  on conflict (storage_path) do nothing;
end $$;
