-- ════════════════════════════════════════════════════════════════
--  REPORTING DESK · 10 · Datos de demostración (OPCIONAL)
--  Carga clientes e informes de ejemplo para ver el Tablero funcionando
--  antes de importar los Excel reales. Idempotente: borra su propia demo
--  antes de recrearla. Puedes NO ejecutarlo en producción.
--  Nota: la gráfica "Productividad por analista" necesita usuarios reales
--  (creados desde la app); la demo llena KPIs, dona de estados y segmentos.
-- ════════════════════════════════════════════════════════════════

-- Limpia demo previa (clientes marcados como DEMO-*).
delete from public.informes  where cliente_id in (select id from public.clientes where sf_account_id like 'DEMO-%');
delete from public.clientes  where sf_account_id like 'DEMO-%';

-- Clientes de ejemplo por segmento.
insert into public.clientes (sf_account_id, nit, nombre, segmento, subsegmento, cliente_valor, esquema_atencion) values
  ('DEMO-1','900100001','CAJA DE VIVIENDA POPULAR (DEMO)','Gobierno','Distrito','PREMIUM','Diamante'),
  ('DEMO-2','900100002','SUBRED CENTRO ORIENTE (DEMO)','Gobierno','Distrito','GOLD','Diamante'),
  ('DEMO-3','900100003','AEROPUERTOS DE ORIENTE (DEMO)','Empresas','Grande','SILVER','Silver/Bronze'),
  ('DEMO-4','900100004','ADIDAS COLOMBIA (DEMO)','Empresas','Grande','SILVER','Silver/Bronze'),
  ('DEMO-5','900100005','INDRA COLOMBIA (DEMO)','Empresas','Mediana','BRONZE','Silver/Bronze'),
  ('DEMO-6','900100006','@DIGITAL GROUP (DEMO)','Mayoristas','Pequeña',null,null),
  ('DEMO-7','900100007','10COM SAS (DEMO)','Mayoristas','Microempresa',null,null),
  ('DEMO-8','900100008','AGENCIA NACIONAL DE TIERRAS (DEMO)','Gobierno','Nación','PREMIUM','Premium');

-- Informes del período actual: 4 por cliente, cada uno con un TIPO distinto
-- (indexado por g = 1..4) para no violar la unicidad
-- (cliente_id, periodo, tipo_informe, area_emite). El estado se sortea.
insert into public.informes (cliente_id, periodo, semana_emision, tipo_informe, area_emite, estado, caso_sf, fecha_envio, sf_validado)
select c.id,
       date_trunc('month', current_date)::date,
       g,
       (array['Estandar','Estandar 2','Especial','Consumo LTE'])[g],
       'Reporting',
       (array['enviado','enviado','programado','pendiente','enviado_parcial'])[1 + floor(random()*5)::int],
       case when random() < 0.6 then (26600000 + (random()*9999)::int)::text else null end,
       case when random() < 0.6 then current_date - (random()*10)::int else null end,
       random() < 0.5
from public.clientes c
cross join generate_series(1, 4) g
where c.sf_account_id like 'DEMO-%';
