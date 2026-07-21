-- ════════════════════════════════════════════════════════════════
--  REPORTING DESK · 08 · Estado "En proceso" + medición de tiempos
--  Flujo: Pendiente/Programado → En proceso (arranca cronómetro) → Enviado
--  Mide: tiempo de gestión (en_proceso → enviado) y tiempo total.
--  Ejecutar en Supabase → SQL Editor (después de tener 01–07).
-- ════════════════════════════════════════════════════════════════

-- 1) Nuevo estado intermedio y reordenamiento del semáforo.
insert into public.estados_informe (codigo, nombre, es_final, color, orden) values
  ('en_proceso', 'En proceso', false, '#8b5cf6', 3)
on conflict (codigo) do nothing;
update public.estados_informe set orden = 4 where codigo = 'enviado_parcial';
update public.estados_informe set orden = 5 where codigo = 'enviado';
update public.estados_informe set orden = 6 where codigo = 'enviado_posventa';

-- 2) Marcas de tiempo de las transiciones (timestamp preciso).
alter table public.informes
  add column if not exists en_proceso_at timestamptz,
  add column if not exists enviado_at    timestamptz;

-- 3) Vista de tiempos por analista (horas promedio de gestión).
create or replace view public.v_tiempos_analista as
select
  u.id as analista_id, u.iniciales, u.nombre,
  count(*) filter (where i.enviado_at is not null and i.en_proceso_at is not null) as gestionados,
  round(avg(extract(epoch from (i.enviado_at - i.en_proceso_at)) / 3600.0)
        filter (where i.enviado_at is not null and i.en_proceso_at is not null)::numeric, 1) as horas_gestion_prom
from public.informes i
join public.usuarios u on u.id = i.analista_id
group by u.id, u.iniciales, u.nombre;
