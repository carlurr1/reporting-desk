/**
 * Enriquece `clientes` con la hoja INFO CLIENTES del LIBRO CONSULTA CLIENTES
 * (supervisor, ANS). Empata por NIT.
 *
 *   npm run import:consulta -- ./LIBRO_CONSULTA_CLIENTES.xlsx "INFO CLIENTES"
 */
import { admin, leerHoja, s, enLotes } from "./_lib";

async function main() {
  const [archivo, hoja = "INFO CLIENTES"] = process.argv.slice(2);
  if (!archivo) { console.error("Uso: import:consulta -- <archivo.xlsx> [hoja]"); process.exit(1); }
  const db = admin();

  const { data: clientes } = await db.from("clientes").select("id, nit");
  const porNit = new Map((clientes ?? []).map((c) => [String(c.nit), c.id]));

  const filas = leerHoja(archivo, hoja);
  let empatados = 0, sin = 0;
  const updates = filas.map((r) => {
    const id = porNit.get(String(s(r["Nit"])));
    if (!id) { sin++; return null; }
    empatados++;
    return {
      id,
      supervisor: s(r["SUPERVISOR"]),
      ans: s(r["ANS"]),
    };
  }).filter(Boolean) as any[];

  await enLotes(updates, 300, async (lote) => {
    // upsert parcial por id (no toca columnas no incluidas gracias a onConflict=id).
    const { error } = await db.from("clientes").upsert(lote, { onConflict: "id" });
    if (error) console.error("Error:", error.message);
  });
  console.log(`Listo. ${empatados} clientes enriquecidos (supervisor/ANS). ${sin} sin empatar por NIT.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
