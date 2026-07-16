-- ════════════════════════════════════════════════════════════════
--  REPORTING DESK · 05 · Auditoría inmutable (historial)
--  Cada cambio en informes y programaciones queda registrado aquí,
--  con quién, cuándo, valor anterior y valor nuevo. Nadie puede
--  modificar ni borrar esta bitácora (append-only, garantizado por RLS
--  y por revocar update/delete). Es la "caja negra" del sistema.
-- ════════════════════════════════════════════════════════════════

create table public.auditoria (
  id           bigint generated always as identity primary key,
  tabla        text not null,                 -- informes, programaciones…
  registro_id  uuid not null,                 -- id de la fila afectada
  accion       text not null check (accion in ('INSERT','UPDATE','DELETE')),
  usuario_id   uuid,                           -- auth.uid() en el momento del cambio
  usuario_iniciales text,                      -- resuelto para lectura rápida
  cambios      jsonb,                          -- { campo: {antes, despues}, ... }
  fila_anterior jsonb,
  fila_nueva    jsonb,
  ocurrido_at  timestamptz not null default now()
);

create index idx_auditoria_registro on public.auditoria (tabla, registro_id);
create index idx_auditoria_usuario  on public.auditoria (usuario_id);
create index idx_auditoria_fecha    on public.auditoria (ocurrido_at);

-- ── Función genérica de auditoría ─────────────────────────────────
create or replace function public.fn_auditar()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_ini  text;
  v_cambios jsonb := '{}'::jsonb;
  k text;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else null end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) else null end;
begin
  select iniciales into v_ini from public.usuarios where id = v_uid;

  -- Diff campo por campo en UPDATE (solo lo que cambió).
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(v_new) loop
      if v_old->k is distinct from v_new->k and k not in ('updated_at') then
        v_cambios := v_cambios || jsonb_build_object(
          k, jsonb_build_object('antes', v_old->k, 'despues', v_new->k));
      end if;
    end loop;
    if v_cambios = '{}'::jsonb then
      return new;   -- nada relevante cambió (solo updated_at)
    end if;
  end if;

  insert into public.auditoria
    (tabla, registro_id, accion, usuario_id, usuario_iniciales, cambios, fila_anterior, fila_nueva)
  values
    (tg_table_name,
     coalesce((v_new->>'id')::uuid, (v_old->>'id')::uuid),
     tg_op, v_uid, v_ini, v_cambios, v_old, v_new);

  return coalesce(new, old);
end $$;

create trigger trg_aud_informes
  after insert or update or delete on public.informes
  for each row execute function public.fn_auditar();

create trigger trg_aud_programaciones
  after insert or update or delete on public.programaciones
  for each row execute function public.fn_auditar();

-- ── RLS de la bitácora: se lee (privilegiados), NUNCA se escribe/borra
alter table public.auditoria enable row level security;
create policy aud_select on public.auditoria for select
  using (public.es_privilegiado());
-- Sin políticas de insert/update/delete → el trigger (SECURITY DEFINER)
-- es el único que puede escribir; ninguna sesión puede alterarla.
revoke update, delete on public.auditoria from authenticated, anon;
