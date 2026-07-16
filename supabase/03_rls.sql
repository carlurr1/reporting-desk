-- ════════════════════════════════════════════════════════════════
--  REPORTING DESK · 03 · Row Level Security
--  Regla de oro:
--   • Todos los roles VEN la programación completa (es trabajo compartido).
--   • El analista solo EDITA el estado/caso de SUS informes.
--   • NADIE borra ni reescribe el histórico: los cambios quedan en la
--     tabla de auditoría (05) y los informes no se eliminan.
--   • Catálogos, clientes y creación de informes: solo privilegiados.
-- ════════════════════════════════════════════════════════════════

alter table public.usuarios          enable row level security;
alter table public.tipos_informe     enable row level security;
alter table public.segmentos         enable row level security;
alter table public.estados_informe   enable row level security;
alter table public.aliados           enable row level security;
alter table public.clientes          enable row level security;
alter table public.cliente_contactos enable row level security;
alter table public.programaciones    enable row level security;
alter table public.informes          enable row level security;
alter table public.sf_casos_cache    enable row level security;

-- ── usuarios ──────────────────────────────────────────────────────
create policy usuarios_select on public.usuarios for select
  using (id = auth.uid() or public.es_privilegiado());
create policy usuarios_admin on public.usuarios for all
  using (public.es_admin()) with check (public.es_admin());

-- ── catálogos (lectura para todos; escritura solo superadmin) ─────
create policy tipos_select on public.tipos_informe for select using (true);
create policy tipos_admin  on public.tipos_informe for all
  using (public.es_admin()) with check (public.es_admin());

create policy seg_select on public.segmentos for select using (true);
create policy seg_admin  on public.segmentos for all
  using (public.es_admin()) with check (public.es_admin());

create policy est_select on public.estados_informe for select using (true);
create policy est_admin  on public.estados_informe for all
  using (public.es_admin()) with check (public.es_admin());

-- ── aliados / clientes / contactos (lectura todos; escritura priv.) ─
create policy aliados_select on public.aliados for select using (true);
create policy aliados_admin  on public.aliados for all
  using (public.es_privilegiado()) with check (public.es_privilegiado());

create policy cli_select on public.clientes for select using (true);
create policy cli_admin  on public.clientes for all
  using (public.es_privilegiado()) with check (public.es_privilegiado());

create policy cont_select on public.cliente_contactos for select using (true);
create policy cont_admin  on public.cliente_contactos for all
  using (public.es_privilegiado()) with check (public.es_privilegiado());

-- ── programaciones (todos leen; coordinación arma el plan) ────────
create policy prog_select on public.programaciones for select using (true);
create policy prog_admin  on public.programaciones for all
  using (public.es_privilegiado()) with check (public.es_privilegiado());

-- ── informes ──────────────────────────────────────────────────────
-- Todos ven la programación completa (para coordinarse).
create policy inf_select on public.informes for select using (true);
-- Crear informes del período: solo coordinación/superadmin (o el generador batch).
create policy inf_insert on public.informes for insert
  with check (public.es_privilegiado());
-- Actualizar: el analista SOLO su propio informe; coordinación cualquiera.
-- (Los cambios quedan registrados por el trigger de auditoría — 05).
create policy inf_update on public.informes for update
  using (analista_id = auth.uid() or public.es_privilegiado())
  with check (analista_id = auth.uid() or public.es_privilegiado());
-- Borrar: NADIE por RLS (ni siquiera coordinación desde la app).
--   El histórico no se elimina; si un informe se anula, se marca por estado.
create policy inf_delete on public.informes for delete using (false);

-- ── cache SF (lectura todos; escritura vía service role / RPC) ────
create policy sf_select on public.sf_casos_cache for select using (true);
create policy sf_admin  on public.sf_casos_cache for all
  using (public.es_privilegiado()) with check (public.es_privilegiado());
