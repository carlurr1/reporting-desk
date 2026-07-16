/**
 * Importa la hoja CLIENTES_SF (export de Salesforce) → tabla `clientes`.
 *
 *   npm run import:clientes -- ./Inventario.xlsx CLIENTES_SF
 *
 * Requiere en el entorno: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 */
import { admin, leerHoja, s, enLotes } from "./_lib";

async function main() {
  const [archivo, hoja = "CLIENTES_SF"] = process.argv.slice(2);
  if (!archivo) { console.error("Uso: import:clientes -- <archivo.xlsx> [hoja]"); process.exit(1); }

  const filas = leerHoja(archivo, hoja);
  console.log(`Leídas ${filas.length} cuentas de "${hoja}".`);

  const registros = filas
    .map((r) => ({
      sf_account_id: s(r["Id"]),
      nombre: s(r["Name"]),
      segmento: s(r["Segmento__c"]),
      subsegmento: s(r["SubSegmento__c"]),
      cliente_valor: s(r["ValordeCliente__c"]),
      esquema_atencion: s(r["Esquema_de_Atencion__c"]),
      ejecutivo_experiencia: s(r["Administrador_Experiencia_al_Cliente__c"]),
      ingeniero_posventa: s(r["Ingeniero_Posventa__c"]),
      nit: s(r["AccountNumber"]),
      identificador_externo: s(r["External_Id__c"]),
      sincronizado_at: new Date().toISOString(),
    }))
    .filter((r) => r.sf_account_id && r.nombre);

  const db = admin();
  let ok = 0;
  await enLotes(registros, 500, async (lote) => {
    const { error, count } = await db.from("clientes")
      .upsert(lote, { onConflict: "sf_account_id", count: "exact" });
    if (error) { console.error("Error en lote:", error.message); return; }
    ok += count ?? lote.length;
    process.stdout.write(`\r  Upsert: ${ok}/${registros.length}`);
  });
  console.log(`\nListo. ${ok} clientes sincronizados.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
