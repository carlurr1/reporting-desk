-- ════════════════════════════════════════════════════════════════
--  REPORTING DESK · 07 · RPC  (funciones que la app llama para métricas
--  y para generar el período. SECURITY DEFINER controlado por rol.)
-- ════════════════════════════════════════════════════════════════

-- ── Generar los informes de un período a partir de la programación ─
--    Toma cada programación activa y crea (si no existe) su informe del
--    mes, en estado 'pendiente'. Idempotente (ON CONFLICT no duplica).
create or replace function public.generar_periodo(p_periodo date)
returns integer
language plpgsql security definer set search_path = public as $$
declare v_creados int;
begin
  if not public.es_privilegiado() then
    raise exception 'No autorizado';
  end if;

  with ins as (
    insert into public.informes
      (programacion_id, cliente_id, periodo, semana_emision,
       tipo_informe, area_emite, analista_id, estado)
    select p.id, p.cliente_id, date_trunc('month', p_periodo)::date,
           p.semana_emision, p.tipo_informe, p.area_emite, p.analista_id,
           'programado'
    from public.programaciones p
    where p.activo
      and coalesce(p.tipo_informe,'') <> 'Sin programación'
    on conflict (cliente_id, periodo, tipo_informe, area_emite) do nothing
    returning 1
  )
  select count(*) into v_creados from ins;
  return v_creados;
end $$;

-- ── Resumen del tablero (una sola llamada para el encabezado) ─────
create or replace function public.resumen_periodo(p_periodo date)
returns table (
  total bigint, enviados bigint, programados bigint,
  pendientes bigint, parciales bigint,
  casos_validados bigint, pct_cumplimiento numeric
)
language sql stable security definer set search_path = public as $$
  select
    count(*),
    count(*) filter (where e.es_final),
    count(*) filter (where i.estado = 'programado'),
    count(*) filter (where i.estado = 'pendiente'),
    count(*) filter (where i.estado = 'enviado_parcial'),
    count(*) filter (where i.sf_validado),
    round(100.0 * count(*) filter (where e.es_final) / nullif(count(*),0), 1)
  from public.informes i
  join public.estados_informe e on e.codigo = i.estado
  where i.periodo = date_trunc('month', p_periodo)::date
$$;
