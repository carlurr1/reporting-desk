-- ════════════════════════════════════════════════════════════════
--  REPORTING DESK · 04 · Semilla de catálogos
--  Valores extraídos de los Excel actuales (Inventario y Programación).
-- ════════════════════════════════════════════════════════════════

insert into public.tipos_informe (nombre, aplica, orden) values
  ('Estandar',        true, 1),
  ('Estandar 2',      true, 2),
  ('Especial',        true, 3),
  ('Consumo LTE',     true, 4),
  ('Informe Aliado',  true, 5),
  ('Sin programación', false, 99)
on conflict (nombre) do nothing;

insert into public.segmentos (nombre, orden) values
  ('Empresas', 1),
  ('Gobierno', 2),
  ('Mayoristas', 3)
on conflict (nombre) do nothing;

-- Ciclo de vida del informe (con colores para el semáforo / gráficas).
insert into public.estados_informe (codigo, nombre, es_final, color, orden) values
  ('pendiente',        'Pendiente',                       false, '#94a3b8', 1),
  ('programado',       'Programado',                      false, '#3b82f6', 2),
  ('enviado_parcial',  'Enviado Parcial - Pdte Info Aliado', false, '#f59e0b', 3),
  ('enviado',          'Enviado',                         true,  '#22c55e', 4),
  ('enviado_posventa', 'Enviado posventa',                true,  '#16a34a', 5),
  ('sin_programacion', 'Sin Programación',                false, '#e2e8f0', 0)
on conflict (codigo) do nothing;
