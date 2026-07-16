// Utilidades compartidas por los importadores.
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

export function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export function leerHoja(archivo: string, hoja: string): Record<string, any>[] {
  const wb = XLSX.readFile(archivo);
  const ws = wb.Sheets[hoja];
  if (!ws) throw new Error(`No existe la hoja "${hoja}". Hojas: ${wb.SheetNames.join(", ")}`);
  return XLSX.utils.sheet_to_json(ws, { defval: null });
}

export const s = (v: any) => (v === null || v === undefined ? null : String(v).trim() || null);

// "Semana 1 (06-10 de abr)" → 1
export function semanaNum(v: any): number | null {
  const m = String(v ?? "").match(/Semana\s*(\d)/i);
  return m ? Number(m[1]) : null;
}

// Estado del Excel → código del catálogo.
export function estadoCodigo(v: any): string {
  const t = String(v ?? "").toLowerCase();
  if (t.includes("posventa")) return "enviado_posventa";
  if (t.includes("parcial")) return "enviado_parcial";
  if (t.includes("enviado")) return "enviado";
  if (t.includes("programado")) return "programado";
  return "sin_programacion";
}

// Divide en lotes para no exceder límites de la API.
export async function enLotes<T>(items: T[], n: number, fn: (lote: T[]) => Promise<void>) {
  for (let i = 0; i < items.length; i += n) await fn(items.slice(i, i + n));
}
