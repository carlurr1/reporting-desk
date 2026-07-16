-- ════════════════════════════════════════════════════════════════
--  REPORTING DESK · 02 · Funciones y triggers
-- ════════════════════════════════════════════════════════════════

-- ── Rol del usuario autenticado ───────────────────────────────────
--    SECURITY DEFINER → lee public.usuarios sin disparar RLS (evita recursión).
create or replace function public.mi_rol()
returns text
language sql stable security definer set search_path = public
as $$ select rol from public.usuarios where id = auth.uid() $$;

create or replace function public.es_privilegiado()
returns boolean
language sql stable security definer set search_path = public
as $$ select public.mi_rol() in ('coordinador','superadmin') $$;

create or replace function public.es_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select public.mi_rol() = 'superadmin' $$;

-- ── El id del informe pertenece al analista autenticado ───────────
create or replace function public.es_mi_informe(p_informe uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.informes
    where id = p_informe and analista_id = auth.uid()
  )
$$;

-- ── updated_at automático ─────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_touch_informes
  before update on public.informes
  for each row execute function public.touch_updated_at();

create trigger trg_touch_programaciones
  before update on public.programaciones
  for each row execute function public.touch_updated_at();

-- ── Resolver el correo de acceso a partir del usuario o correo ────
--    Permite iniciar sesión con el login genérico aunque el email de
--    auth haya cambiado a uno real (mismo patrón que Pulso).
create or replace function public.auth_email_de(p_ident text)
returns text
language sql stable security definer set search_path = public, auth
as $$
  select u.email
  from public.usuarios pu
  join auth.users u on u.id = pu.id
  where pu.login = lower(p_ident)
     or pu.email_real = lower(p_ident)
     or pu.iniciales = upper(p_ident)
  limit 1
$$;
