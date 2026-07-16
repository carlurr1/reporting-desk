-- ════════════════════════════════════════════════════════════════
--  REPORTING DESK · 06 · Vistas KPI  (la capa "Power BI")
--  Vistas de solo lectura que alimentan las gráficas del tablero.
-- ════════════════════════════════════════════════════════════════

-- ── Productividad por analista y período ──────────────────────────
--    Enviados = estados finales (enviado / enviado_posventa).
create or replace view public.v_productividad_analista as
select
  i.periodo,
  u.id            as analista_id,
  u.iniciales,
  u.nombre,
  u.apellido,
  count(*)                                              as total,
  count(*) filter (where e.es_final)                    as enviados,
  count(*) filter (where i.estado = 'programado')       as programados,
  count(*) filter (where i.estado = 'pendiente')        as pendientes,
  count(*) filter (where i.estado = 'enviado_parcial')  as parciales,
  count(*) filter (where i.caso_sf is not null)         as con_caso,
  count(*) filter (where i.sf_validado)                 as casos_validados,
  round(100.0 * count(*) filter (where e.es_final)
        / nullif(count(*),0), 1)                        as pct_cumplimiento
from public.informes i
join public.usuarios u        on u.id = i.analista_id
join public.estados_informe e on e.codigo = i.estado
group by i.periodo, u.id, u.iniciales, u.nombre, u.apellido;

-- ── Estado global por período (para el semáforo / dona) ───────────
create or replace view public.v_estado_periodo as
select
  i.periodo,
  i.estado,
  e.nombre  as estado_nombre,
  e.color,
  count(*)  as total
from public.informes i
join public.estados_informe e on e.codigo = i.estado
group by i.periodo, i.estado, e.nombre, e.color;

-- ── Cumplimiento por segmento y período ───────────────────────────
create or replace view public.v_cumplimiento_segmento as
select
  i.periodo,
  c.segmento,
  count(*)                                    as total,
  count(*) filter (where e.es_final)          as enviados,
  round(100.0 * count(*) filter (where e.es_final)
        / nullif(count(*),0), 1)              as pct
from public.informes i
join public.clientes c        on c.id = i.cliente_id
join public.estados_informe e on e.codigo = i.estado
group by i.periodo, c.segmento;

-- ── Control de calidad de casos Salesforce ────────────────────────
--    Cuántos informes marcados como enviados tienen caso SF real.
create or replace view public.v_control_casos_sf as
select
  i.periodo,
  count(*) filter (where e.es_final)                          as enviados,
  count(*) filter (where e.es_final and i.caso_sf is not null) as con_caso,
  count(*) filter (where e.es_final and i.sf_validado)         as validados,
  count(*) filter (where e.es_final and i.caso_sf is not null
                        and not i.sf_validado)                 as caso_no_valido,
  count(*) filter (where e.es_final and i.caso_sf is null)     as sin_caso
from public.informes i
join public.estados_informe e on e.codigo = i.estado
group by i.periodo;

-- ── Tendencia mensual (envíos por mes) ────────────────────────────
create or replace view public.v_tendencia_mensual as
select
  i.periodo,
  count(*)                             as total,
  count(*) filter (where e.es_final)   as enviados
from public.informes i
join public.estados_informe e on e.codigo = i.estado
group by i.periodo
order by i.periodo;
