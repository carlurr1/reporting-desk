"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Solo superadmin puede importar.
async function exigirAdmin() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Sin sesión");
  const { data } = await sb.from("usuarios").select("rol").eq("id", user.id).single();
  if (data?.rol !== "superadmin") throw new Error("No autorizado");
}

// ── Clientes (hoja CLIENTES_SF) ───────────────────────────────────
// Recibe lotes ya mapeados desde el navegador; hace upsert por sf_account_id.
export async function importarClientesLote(
  filas: Record<string, any>[]
): Promise<{ ok: boolean; n?: number; error?: string }> {
  try { await exigirAdmin(); } catch (e: any) { return { ok: false, error: e.message }; }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY en Vercel." };
  const db = createAdminClient();
  const limpias = filas.filter((r) => r.sf_account_id && r.nombre)
    .map((r) => ({ ...r, sincronizado_at: new Date().toISOString() }));
  if (!limpias.length) return { ok: true, n: 0 };
  const { error, count } = await db.from("clientes")
    .upsert(limpias, { onConflict: "sf_account_id", count: "exact" });
  if (error) return { ok: false, error: error.message };
  return { ok: true, n: count ?? limpias.length };
}

// ── Programación / informes (hoja CALENDARIO_<MES>) ───────────────
// Recibe las filas PROGRAMADAS del mes (ya filtradas y mapeadas en el
// navegador) + el período. Resuelve cliente (por sf/nit) y analista (por
// iniciales) y hace upsert en informes.
export async function importarProgramacion(
  filas: {
    sf_account_id?: string | null; nit?: string | null;
    semana_emision?: number | null; tipo_informe?: string | null;
    area_emite?: string | null; estado: string; caso_sf?: string | null;
    fecha_envio?: string | null; informacion_pendiente?: string | null;
    analista_ini?: string | null;
  }[],
  periodoYYYYMM: string
): Promise<{ ok: boolean; n?: number; sinCliente?: number; sinAnalista?: number; duplicados?: number; error?: string }> {
  try { await exigirAdmin(); } catch (e: any) { return { ok: false, error: e.message }; }
  const db = createAdminClient();
  const periodo = `${periodoYYYYMM}-01`;

  const [{ data: clientes }, { data: usuarios }] = await Promise.all([
    db.from("clientes").select("id, sf_account_id, nit"),
    db.from("usuarios").select("id, iniciales"),
  ]);
  const porSf = new Map((clientes ?? []).map((c) => [c.sf_account_id, c.id]));
  const porNit = new Map((clientes ?? []).map((c) => [String(c.nit), c.id]));
  const porIni = new Map((usuarios ?? []).map((u) => [String(u.iniciales).toUpperCase(), u.id]));

  let sinCliente = 0, sinAnalista = 0;
  const informes = filas.map((r) => {
    const cliente_id = porSf.get(r.sf_account_id ?? "") ?? porNit.get(String(r.nit));
    if (!cliente_id) { sinCliente++; return null; }
    const ini = String(r.analista_ini ?? "").toUpperCase();
    const analista_id = porIni.get(ini) ?? null;
    if (ini && !analista_id) sinAnalista++;
    return {
      cliente_id, periodo,
      semana_emision: r.semana_emision ?? null,
      tipo_informe: r.tipo_informe ?? null,
      area_emite: r.area_emite ?? null,
      analista_id,
      estado: r.estado,
      caso_sf: r.caso_sf ?? null,
      fecha_envio: r.fecha_envio ?? null,
      informacion_pendiente: r.informacion_pendiente ?? null,
    };
  }).filter(Boolean) as any[];

  // Elimina duplicados dentro del mismo archivo: la clave única es
  // (cliente_id, periodo, tipo_informe, area_emite). Postgres no permite
  // tocar la misma fila dos veces en un upsert. Si tipo o área vienen vacíos,
  // no se agrupan (la BD los trata como distintos). Se queda la última fila.
  const mapa = new Map<string, any>();
  let libre = 0, duplicados = 0;
  for (const inf of informes) {
    const clave = inf.tipo_informe && inf.area_emite
      ? `${inf.cliente_id}|${inf.periodo}|${inf.tipo_informe}|${inf.area_emite}`
      : `__x${libre++}`;
    if (mapa.has(clave)) duplicados++;
    mapa.set(clave, inf);
  }
  const unicos = [...mapa.values()];

  if (!unicos.length) return { ok: true, n: 0, sinCliente, sinAnalista };
  const { error, count } = await db.from("informes")
    .upsert(unicos, { onConflict: "cliente_id,periodo,tipo_informe,area_emite", count: "exact" });
  if (error) return { ok: false, error: error.message };
  return { ok: true, n: count ?? unicos.length, sinCliente, sinAnalista, duplicados };
}
