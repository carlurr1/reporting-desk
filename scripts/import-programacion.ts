/**
 * Importa una hoja CALENDARIO_<MES> → programaciones + informes del período.
 *
 *   npm run import:programacion -- ./Inventario.xlsx CALENDARIO_ABRIL 2026-04
 *
 * Solo migra las filas realmente PROGRAMADAS (ignora "Sin Programación").
 * Empata el cliente por Id de cuenta SF (o NIT) y el analista por iniciales.
 */
import { admin, leerHoja, s, semanaNum, estadoCodigo, enLotes } from "./_lib";

async function main() {
  const [archivo, hoja, periodoArg] = process.argv.slice(2);
  if (!archivo || !hoja || !periodoArg) {
    console.error("Uso: import:programacion -- <archivo.xlsx> <HOJA> <YYYY-MM>");
    process.exit(1);
  }
  const periodo = `${periodoArg}-01`;
  const db = admin();

  // Índices de apoyo: cliente por sf_account_id y por nit; analista por iniciales.
  const { data: clientes } = await db.from("clientes").select("id, sf_account_id, nit");
  const porSf = new Map((clientes ?? []).map((c) => [c.sf_account_id, c.id]));
  const porNit = new Map((clientes ?? []).map((c) => [String(c.nit), c.id]));
  const { data: usuarios } = await db.from("usuarios").select("id, iniciales");
  const porIni = new Map((usuarios ?? []).map((u) => [String(u.iniciales).toUpperCase(), u.id]));

  const filas = leerHoja(archivo, hoja);
  const programadas = filas.filter((r) => estadoCodigo(r["Estado"]) !== "sin_programacion");
  console.log(`Hoja "${hoja}": ${filas.length} filas, ${programadas.length} programadas.`);

  let sinCliente = 0, sinAnalista = 0;
  const informes = programadas.map((r) => {
    const cliente_id = porSf.get(s(r["Id. de la cuenta"])) ??
                       porNit.get(String(s(r["Número de Documento"])));
    if (!cliente_id) sinCliente++;
    const ini = String(s(r["Analista"]) ?? "").toUpperCase();
    const analista_id = porIni.get(ini) ?? null;
    if (ini && !analista_id) sinAnalista++;

    const fecha = r["Fecha de Envío"];
    return cliente_id ? {
      cliente_id,
      periodo,
      semana_emision: semanaNum(r["Semana de Emisión"]),
      tipo_informe: s(r["Tipo de Informe"]),
      area_emite: s(r["Area emite"]),
      analista_id,
      estado: estadoCodigo(r["Estado"]),
      caso_sf: s(r["Caso SF"]),
      fecha_envio: fecha instanceof Date ? fecha.toISOString().slice(0, 10) : s(fecha),
      informacion_pendiente: s(r["Información Pendiente"]),
    } : null;
  }).filter(Boolean) as any[];

  let ok = 0;
  await enLotes(informes, 500, async (lote) => {
    const { error, count } = await db.from("informes")
      .upsert(lote, { onConflict: "cliente_id,periodo,tipo_informe,area_emite", count: "exact" });
    if (error) { console.error("Error en lote:", error.message); return; }
    ok += count ?? lote.length;
    process.stdout.write(`\r  Upsert informes: ${ok}/${informes.length}`);
  });
  console.log(`\nListo. ${ok} informes del período ${periodoArg}.`);
  if (sinCliente) console.log(`  ⚠ ${sinCliente} filas sin cliente empatado (revisa el sync de clientes).`);
  if (sinAnalista) console.log(`  ⚠ ${sinAnalista} filas con analista no registrado (crea el usuario con esas iniciales).`);
}
main().catch((e) => { console.error(e); process.exit(1); });
