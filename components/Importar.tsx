"use client";
import { useState } from "react";
import * as XLSX from "xlsx";
import { importarClientesLote, importarProgramacion } from "@/app/importar/actions";

const S = (v: any) => (v === null || v === undefined ? null : String(v).trim() || null);
const semanaNum = (v: any) => {
  const m = String(v ?? "").match(/Semana\s*(\d)/i);
  return m ? Number(m[1]) : null;
};
const estadoCodigo = (v: any) => {
  const t = String(v ?? "").toLowerCase();
  if (t.includes("posventa")) return "enviado_posventa";
  if (t.includes("parcial")) return "enviado_parcial";
  if (t.includes("enviado")) return "enviado";
  if (t.includes("programado")) return "programado";
  return "sin_programacion";
};
const excelFecha = (v: any): string | null => {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = XLSX.SSF ? new Date(Math.round((v - 25569) * 86400 * 1000)) : null;
    return d && !isNaN(+d) ? d.toISOString().slice(0, 10) : null;
  }
  const s = String(v).trim();
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

type Modo = "clientes" | "programacion";

export default function Importar() {
  const [wb, setWb] = useState<XLSX.WorkBook | null>(null);
  const [hojas, setHojas] = useState<string[]>([]);
  const [hoja, setHoja] = useState("");
  const [modo, setModo] = useState<Modo>("clientes");
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7));
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const add = (m: string) => setLog((l) => [...l, m]);

  const onFile = async (f: File) => {
    setLog([]);
    add(`Leyendo ${f.name} (${(f.size / 1e6).toFixed(1)} MB)…`);
    const buf = await f.arrayBuffer();
    const book = XLSX.read(buf, { cellDates: true });
    setWb(book); setHojas(book.SheetNames);
    // Preselección inteligente de hoja según el modo.
    const pref = modo === "clientes"
      ? book.SheetNames.find((s) => /CLIENTES_SF/i.test(s))
      : book.SheetNames.find((s) => /CALENDARIO_[A-Z]/i.test(s));
    setHoja(pref ?? book.SheetNames[0]);
    add(`Hojas: ${book.SheetNames.join(", ")}`);
  };

  const filasDe = (): Record<string, any>[] => {
    const ws = wb!.Sheets[hoja];
    return XLSX.utils.sheet_to_json(ws, { defval: null });
  };

  const cargarClientes = async () => {
    const filas = filasDe();
    const mapeadas = filas.map((r) => ({
      sf_account_id: S(r["Id"]),
      nombre: S(r["Name"]),
      segmento: S(r["Segmento__c"]),
      subsegmento: S(r["SubSegmento__c"]),
      cliente_valor: S(r["ValordeCliente__c"]),
      esquema_atencion: S(r["Esquema_de_Atencion__c"]),
      ejecutivo_experiencia: S(r["Administrador_Experiencia_al_Cliente__c"]),
      ingeniero_posventa: S(r["Ingeniero_Posventa__c"]),
      nit: S(r["AccountNumber"]),
      identificador_externo: S(r["External_Id__c"]),
    })).filter((r) => r.sf_account_id && r.nombre);
    add(`${mapeadas.length} clientes válidos. Subiendo por lotes…`);
    let ok = 0;
    for (let i = 0; i < mapeadas.length; i += 800) {
      const lote = mapeadas.slice(i, i + 800);
      const r = await importarClientesLote(lote);
      if (!r.ok) { add(`❌ Error: ${r.error}`); return; }
      ok += r.n ?? 0;
      add(`  ${ok}/${mapeadas.length}…`);
    }
    add(`✅ Listo. ${ok} clientes sincronizados.`);
  };

  const cargarProgramacion = async () => {
    const filas = filasDe();
    const prog = filas
      .filter((r) => estadoCodigo(r["Estado"]) !== "sin_programacion")
      .map((r) => ({
        sf_account_id: S(r["Id. de la cuenta"]),
        nit: S(r["Número de Documento"]),
        semana_emision: semanaNum(r["Semana de Emisión"]),
        tipo_informe: S(r["Tipo de Informe"]),
        area_emite: S(r["Area emite"]),
        estado: estadoCodigo(r["Estado"]),
        caso_sf: S(r["Caso SF"]),
        fecha_envio: excelFecha(r["Fecha de Envío"]),
        informacion_pendiente: S(r["Información Pendiente"]),
        analista_ini: S(r["Analista"]),
      }));
    add(`${prog.length} informes programados en la hoja. Subiendo…`);
    const r = await importarProgramacion(prog, periodo);
    if (!r.ok) { add(`❌ Error: ${r.error}`); return; }
    add(`✅ Listo. ${r.n} informes del período ${periodo}.`);
    if (r.duplicados) add(`  ℹ ${r.duplicados} filas duplicadas en el archivo (se guardó la última de cada una).`);
    if (r.sinCliente) add(`  ⚠ ${r.sinCliente} sin cliente empatado (importa primero los clientes).`);
    if (r.sinAnalista) add(`  ⚠ ${r.sinAnalista} con analista no registrado (crea el usuario con esas iniciales).`);
  };

  const cargar = async () => {
    if (!wb || !hoja) { add("Selecciona un archivo y una hoja."); return; }
    setBusy(true);
    try { modo === "clientes" ? await cargarClientes() : await cargarProgramacion(); }
    catch (e: any) { add(`❌ ${e?.message ?? e}`); }
    finally { setBusy(false); }
  };

  return (
    <div className="card">
      <h2>Importar desde Excel</h2>
      <p className="sub" style={{ marginTop: 0 }}>
        Sube el archivo de inventario/programación. Primero <b>Clientes</b> (una vez),
        luego <b>Programación</b> por cada mes.
      </p>

      <div className="row" style={{ alignItems: "center", marginBottom: 10 }}>
        <label className="lbl" style={{ margin: 0 }}>Tipo de carga:</label>
        <select value={modo} onChange={(e) => setModo(e.target.value as Modo)}>
          <option value="clientes">Clientes (hoja CLIENTES_SF)</option>
          <option value="programacion">Programación (hoja CALENDARIO_&lt;MES&gt;)</option>
        </select>
        {modo === "programacion" && (
          <>
            <label className="lbl" style={{ margin: 0 }}>Período:</label>
            <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
          </>
        )}
      </div>

      <input type="file" accept=".xlsx,.xls" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />

      {hojas.length > 0 && (
        <div className="row" style={{ alignItems: "center", marginTop: 10 }}>
          <label className="lbl" style={{ margin: 0 }}>Hoja:</label>
          <select value={hoja} onChange={(e) => setHoja(e.target.value)}>
            {hojas.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          <button className="btn primary" onClick={cargar} disabled={busy}>
            {busy ? "Cargando…" : "Cargar"}
          </button>
        </div>
      )}

      {log.length > 0 && (
        <pre style={{ marginTop: 14, background: "#f8fafc", border: "1px solid #e2e8f0",
          borderRadius: 8, padding: 12, fontSize: 12, maxHeight: 260, overflowY: "auto" }}>
          {log.join("\n")}
        </pre>
      )}
    </div>
  );
}
