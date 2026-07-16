"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loginToEmail, slugLogin } from "@/lib/loginEmail";
import { consultarCasos } from "@/lib/sfCaso";
import type { Rol } from "@/lib/types";

// ─── Guardas de rol ───────────────────────────────────────────────
async function usuarioActual() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Sin sesión");
  const { data } = await sb.from("usuarios").select("id, rol, iniciales").eq("id", user.id).single();
  return { sb, user, perfil: data as { id: string; rol: Rol; iniciales: string | null } | null };
}

async function exigirAdmin() {
  const { perfil } = await usuarioActual();
  if (perfil?.rol !== "superadmin") throw new Error("No autorizado");
}

// ═══════════════════════════════════════════════════════════════
//  Marcar un informe como enviado + validar el caso en Salesforce
//  El analista solo puede tocar SUS informes (reforzado por RLS).
//  El caso se consulta en SF: si el Account.Name coincide con el
//  cliente del informe → sf_validado = true ("es un caso real").
// ═══════════════════════════════════════════════════════════════
export async function registrarEnvio(input: {
  informe_id: string;
  caso_sf: string;
  fecha_envio?: string;             // ISO date; por defecto hoy
  estado?: "enviado" | "enviado_parcial" | "enviado_posventa";
  informacion_pendiente?: string;
}): Promise<{ ok: boolean; error?: string; validado?: boolean; sf_cliente?: string | null }> {
  const { sb } = await usuarioActual();

  // Nombre del cliente del informe (para comparar contra SF).
  const { data: inf } = await sb
    .from("informes")
    .select("id, cliente_id, clientes(nombre)")
    .eq("id", input.informe_id)
    .single();
  if (!inf) return { ok: false, error: "Informe no encontrado o sin permiso." };

  const nombreCliente = (inf as any).clientes?.nombre as string | undefined;

  // Consulta Salesforce (best-effort: si SF falla, se registra sin validar).
  let sf_cliente: string | null = null;
  let sf_estado: string | null = null;
  let sf_validado = false;
  let sf_consultado_at: string | null = null;
  try {
    const [caso] = await consultarCasos([input.caso_sf]);
    if (caso) {
      sf_cliente = caso.cliente;
      sf_estado = caso.estado;
      sf_consultado_at = new Date().toISOString();
      sf_validado = !!(sf_cliente && nombreCliente &&
        norm(sf_cliente) === norm(nombreCliente));
      // Cachea la respuesta cruda para auditoría / dashboards.
      await createAdminClient().from("sf_casos_cache").upsert({
        caso_sf: caso.numero_caso, cliente: caso.cliente, estado: caso.estado,
        prioridad: caso.prioridad, tipo: caso.tipo, origen: caso.origen,
        owner: caso.owner, fecha_creacion: caso.fecha_creacion,
        fecha_cierre: caso.fecha_cierre, crudo: caso as any,
        consultado_at: sf_consultado_at,
      });
    }
  } catch {
    // Salesforce no disponible: se guarda el envío igual, sin validación.
  }

  const { error } = await sb.from("informes").update({
    estado: input.estado ?? "enviado",
    caso_sf: input.caso_sf.trim(),
    fecha_envio: input.fecha_envio ?? new Date().toISOString().slice(0, 10),
    informacion_pendiente: input.informacion_pendiente ?? null,
    sf_cliente, sf_estado, sf_validado, sf_consultado_at,
  }).eq("id", input.informe_id);

  if (error) return { ok: false, error: error.message };
  return { ok: true, validado: sf_validado, sf_cliente };
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");

// ═══════════════════════════════════════════════════════════════
//  Generar el período (crea los informes del mes desde la programación)
// ═══════════════════════════════════════════════════════════════
export async function generarPeriodo(periodo: string): Promise<{ ok: boolean; creados?: number; error?: string }> {
  const { sb, perfil } = await usuarioActual();
  if (!perfil || !["coordinador", "superadmin"].includes(perfil.rol))
    return { ok: false, error: "No autorizado" };
  const { data, error } = await sb.rpc("generar_periodo", { p_periodo: periodo });
  if (error) return { ok: false, error: error.message };
  return { ok: true, creados: data as number };
}

// ═══════════════════════════════════════════════════════════════
//  Crear un usuario del equipo (solo superadmin)
// ═══════════════════════════════════════════════════════════════
export async function crearUsuario(input: {
  login: string; iniciales: string; nombre: string; apellido: string;
  rol: Rol; cargo: string; area?: string; password: string; email_real?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try { await exigirAdmin(); } catch { return { ok: false, error: "No autorizado." }; }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY en el entorno." };
  if (!input.password || input.password.length < 6)
    return { ok: false, error: "La contraseña debe tener al menos 6 caracteres." };
  if (!slugLogin(input.login))
    return { ok: false, error: "Usuario inválido (solo letras/números)." };

  const admin = createAdminClient();
  const { data: authUser, error: e1 } = await admin.auth.admin.createUser({
    email: loginToEmail(input.login),
    password: input.password,
    email_confirm: true,
    user_metadata: { login: input.login },
  });
  if (e1 || !authUser?.user) return { ok: false, error: e1?.message ?? "No se pudo crear el acceso." };

  const { error: e2 } = await admin.from("usuarios").insert({
    id: authUser.user.id, login: input.login.toLowerCase(),
    iniciales: input.iniciales.toUpperCase(), nombre: input.nombre, apellido: input.apellido,
    rol: input.rol, cargo: input.cargo, area: input.area ?? "Reporting",
    email_real: input.email_real?.trim().toLowerCase() || null,
  });
  if (e2) {
    await admin.auth.admin.deleteUser(authUser.user.id).catch(() => {});
    return { ok: false, error: e2.message };
  }
  return { ok: true, id: authUser.user.id };
}
