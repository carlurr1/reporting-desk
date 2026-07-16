-- ════════════════════════════════════════════════════════════════
--  REPORTING DESK · ETB — Inventario y Programación de Informes
--  01 · Esquema base (tablas, extensiones, índices)
--  Ejecutar en Supabase → SQL Editor EN ORDEN:
--    01_schema → 02_functions → 03_rls → 04_seed_catalogo
--    → 05_auditoria → 06_vistas_kpi → 07_rpc
-- ════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ════════════════════════════════════════════════════════════════
--  1) USUARIOS  (1:1 con auth.users — perfil + rol + iniciales)
--  Las "iniciales" (GA, KM, YM, CU, LR, FD, TS, AM, DP…) son la llave
--  que empata al analista con la columna "Analista" del Excel.
-- ════════════════════════════════════════════════════════════════
create table public.usuarios (
  id          uuid primary key references auth.users(id) on delete cascade,
  login       text unique not null,                 -- usuario genérico (ej. galarcon)
  iniciales   text unique,                           -- GA, KM… (empata el Excel)
  nombre      text not null,
  apellido    text,
  rol         text not null default 'analista'
              check (rol in ('analista','coordinador','superadmin','consulta')),
  cargo       text,                                  -- "Analista Reporting", "Coordinador"…
  area        text default 'Reporting',              -- Reporting / InformesHdp / Posventa
  email_real  text,                                  -- correo real (para reset de clave)
  bloqueado   boolean not null default false,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════
--  2) CATÁLOGOS  (configurables por el superadmin — reemplazan las
--     "listas" del Excel para que todos usen los mismos valores)
-- ════════════════════════════════════════════════════════════════
create table public.tipos_informe (
  id        uuid primary key default gen_random_uuid(),
  nombre    text unique not null,                    -- Estandar, Estandar 2, Especial, Consumo LTE, Informe Aliado
  aplica    boolean not null default true,           -- false = "Sin programación"
  orden     int default 0,
  activo    boolean not null default true
);

create table public.segmentos (
  id        uuid primary key default gen_random_uuid(),
  nombre    text unique not null,                    -- Empresas, Gobierno, Mayoristas
  orden     int default 0
);

-- Estados del ciclo de vida de un informe (con orden para el semáforo).
create table public.estados_informe (
  codigo    text primary key,                        -- pendiente, programado, enviado, enviado_parcial, enviado_posventa
  nombre    text not null,                           -- etiqueta legible
  es_final  boolean not null default false,          -- cuenta como "cumplido"
  color     text,                                    -- para gráficas / semáforo
  orden     int default 0
);

-- ════════════════════════════════════════════════════════════════
--  3) ALIADOS  (BASE_ALIADOS_SUPS — proveedores que emiten informes)
-- ════════════════════════════════════════════════════════════════
create table public.aliados (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  nit           text,
  supervisor    text,
  estado        text,                                -- Ejecución, Suspensión, Liquidación…
  objeto        text,
  fecha_inicio  date,
  fecha_fin     date,
  activo        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════
--  4) CLIENTES  (espejo de CLIENTES_SF + INFO CLIENTES / CONTACTOS)
--  La cuenta de Salesforce es la fuente de verdad; se sincroniza.
-- ════════════════════════════════════════════════════════════════
create table public.clientes (
  id                    uuid primary key default gen_random_uuid(),
  sf_account_id         text unique,                 -- Id de la cuenta en Salesforce (0013300001…)
  nit                   text,                        -- AccountNumber / Número de Documento
  identificador_externo text,
  nombre                text not null,               -- Nombre de la cuenta
  segmento              text,                        -- Empresas / Gobierno / Mayoristas
  subsegmento           text,                        -- Grande, Mediana, Distrito, Nación…
  cliente_valor         text,                        -- PREMIUM, GOLD, SILVER, BRONZE…
  esquema_atencion      text,                        -- Diamante, Premium, Silver/Bronze…
  tipo_cliente          text,                        -- Cliente / Prospecto
  ejecutivo_experiencia text,                        -- Administrador de experiencia
  ingeniero_posventa    text,
  supervisor            text,                        -- del LIBRO CONSULTA
  ans                   text,                        -- ANS pactado
  activo                boolean not null default true,
  sincronizado_at       timestamptz,                 -- última sync desde SF
  created_at            timestamptz not null default now()
);

create table public.cliente_contactos (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.clientes(id) on delete cascade,
  nombre      text,
  cargo       text,
  telefono    text,
  correo      text,
  principal   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════
--  5) PROGRAMACIONES  (el "plan" recurrente — qué informe recibe cada
--     cliente, con qué frecuencia, en qué semana y qué analista lo
--     tiene asignado). Es la plantilla estable, no el envío mensual.
-- ════════════════════════════════════════════════════════════════
create table public.programaciones (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null references public.clientes(id) on delete cascade,
  tipo_informe    text references public.tipos_informe(nombre),
  frecuencia      text not null default 'Mensual'
                  check (frecuencia in ('Mensual','Semanal','N/A')),
  semana_emision  int check (semana_emision between 1 and 5),
  area_emite      text default 'Reporting',          -- Reporting / InformesHdp / Posventa
  analista_id     uuid references public.usuarios(id),
  aliado_id       uuid references public.aliados(id),
  activo          boolean not null default true,
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (cliente_id, tipo_informe, area_emite)
);

-- ════════════════════════════════════════════════════════════════
--  6) INFORMES  (el registro TRANSACCIONAL — una fila por informe que
--     se debe enviar en un período. Aquí vive la gestión diaria, el
--     estado, el caso de Salesforce y la fecha real de envío).
--     De aquí salen TODAS las métricas de productividad y "al día".
-- ════════════════════════════════════════════════════════════════
create table public.informes (
  id                   uuid primary key default gen_random_uuid(),
  programacion_id      uuid references public.programaciones(id) on delete set null,
  cliente_id           uuid not null references public.clientes(id) on delete cascade,
  periodo              date not null,                -- primer día del mes (2026-04-01)
  semana_emision       int check (semana_emision between 1 and 5),
  tipo_informe         text,
  area_emite           text,
  analista_id          uuid references public.usuarios(id),

  estado               text not null default 'pendiente'
                       references public.estados_informe(codigo),
  fecha_envio          date,
  informacion_pendiente text,                        -- por qué no se ha enviado / aliado pendiente

  -- Integración Salesforce (validación del "caso informativo")
  caso_sf              text,                         -- número de caso (26623524)
  sf_cliente           text,                         -- Account.Name devuelto por SF
  sf_estado            text,                         -- Status del caso en SF
  sf_validado          boolean not null default false, -- el caso existe y el cliente coincide
  sf_consultado_at     timestamptz,

  registrado_por       uuid references public.usuarios(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (cliente_id, periodo, tipo_informe, area_emite)
);

-- ════════════════════════════════════════════════════════════════
--  7) CACHE DE CASOS SF  (respuesta cruda de Salesforce por caso, para
--     no golpear la API repetidamente y auditar la validación)
-- ════════════════════════════════════════════════════════════════
create table public.sf_casos_cache (
  caso_sf        text primary key,
  cliente        text,
  estado         text,
  prioridad      text,
  tipo           text,
  origen         text,
  owner          text,
  fecha_creacion timestamptz,
  fecha_cierre   timestamptz,
  crudo          jsonb,
  consultado_at  timestamptz not null default now()
);

-- ── Índices para dashboards, bandeja y búsquedas ──────────────────
create index idx_clientes_nit          on public.clientes (nit);
create index idx_clientes_segmento     on public.clientes (segmento);
create index idx_prog_cliente          on public.programaciones (cliente_id);
create index idx_prog_analista         on public.programaciones (analista_id);
create index idx_informes_periodo      on public.informes (periodo);
create index idx_informes_analista_per on public.informes (analista_id, periodo);
create index idx_informes_estado       on public.informes (estado);
create index idx_informes_cliente      on public.informes (cliente_id);
create index idx_informes_caso_sf      on public.informes (caso_sf);
