"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { registrarEnvio, iniciarGestion } from "@/app/actions";
import type { Usuario } from "@/lib/types";

type Fila = {
  id: string; periodo: string; tipo_informe: string | null; estado: string;
  caso_sf: string | null; fecha_envio: string | null; sf_validado: boolean;
  semana_emision: number | null; informacion_pendiente: string | null;
  en_proceso_at: string | null; enviado_at: string | null;
  clientes: { nombre: string; segmento: string | null; nit: string | null } | null;
};

const EST: Record<string, { label: string; color: string }> = {
  pendiente:        { label: "Pendiente",  color: "#94a3b8" },
  programado:       { label: "Programado", color: "#3b82f6" },
  en_proceso:       { label: "En proceso", color: "#8b5cf6" },
  enviado_parcial:  { label: "Parcial",    color: "#f59e0b" },
  enviado:          { label: "Enviado",    color: "#22c55e" },
  enviado_posventa: { label: "Enviado posventa", color: "#16a34a" },
};

// Duración legible entre dos instantes.
function dur(desde: string | null, hasta: string | null): string {
  if (!desde || !hasta) return "—";
  const ms = new Date(hasta).getTime() - new Date(desde).getTime();
  if (ms < 0) return "—";
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  if (h < 24) return `${h}h ${m}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}
const desdeHace = (iso: string | null) => {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

export default function Bandeja({ perfil, periodo }: { perfil: Usuario; periodo: string }) {
  const sb = useMemo(() => createClient(), []);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<"todos" | "pendientes" | "proceso" | "enviados">("todos");
  const [activo, setActivo] = useState<Fila | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = async () => {
    setCargando(true);
    const { data } = await sb.from("informes")
      .select("id,periodo,tipo_informe,estado,caso_sf,fecha_envio,sf_validado,semana_emision,informacion_pendiente,en_proceso_at,enviado_at,clientes(nombre,segmento,nit)")
      .eq("analista_id", perfil.id).eq("periodo", periodo)
      .order("semana_emision", { ascending: true });
    setFilas((data as any) ?? []);
    setCargando(false);
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [sb, periodo, perfil.id]);

  const iniciar = async (f: Fila) => {
    setOcupado(f.id);
    await iniciarGestion(f.id);
    await cargar();
    setOcupado(null);
  };

  const visibles = filas.filter((f) =>
    filtro === "todos" ? true :
    filtro === "enviados" ? ["enviado", "enviado_posventa", "enviado_parcial"].includes(f.estado) :
    filtro === "proceso" ? f.estado === "en_proceso" :
    ["pendiente", "programado"].includes(f.estado));

  const porGestionar = filas.filter((f) => ["pendiente", "programado", "en_proceso"].includes(f.estado)).length;

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Mi bandeja · {filas.length} informes · {porGestionar} por gestionar</h2>
        <select value={filtro} onChange={(e) => setFiltro(e.target.value as any)}>
          <option value="todos">Todos</option>
          <option value="pendientes">Por iniciar</option>
          <option value="proceso">En proceso</option>
          <option value="enviados">Enviados</option>
        </select>
      </div>

      {cargando ? <p className="sub">Cargando…</p> : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Cliente</th><th>Sem.</th><th>Tipo</th><th>Estado</th>
                <th>Caso SF</th><th>Tiempo gestión</th><th></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => (
                <tr key={f.id}>
                  <td>{f.clientes?.nombre ?? "—"}<div className="sub tiny">{f.clientes?.segmento ?? ""}</div></td>
                  <td>{f.semana_emision ?? "—"}</td>
                  <td>{f.tipo_informe ?? "—"}</td>
                  <td>
                    <span className="badge" style={{ background: EST[f.estado]?.color ?? "#94a3b8" }}>{EST[f.estado]?.label ?? f.estado}</span>
                    {f.estado === "en_proceso" && <div className="sub tiny">desde {desdeHace(f.en_proceso_at)}</div>}
                  </td>
                  <td>{f.caso_sf ? <span title={f.sf_validado ? "Validado en Salesforce" : "Sin validar"}>{f.caso_sf} {f.sf_validado ? "✅" : "⚠️"}</span> : <span className="sub">—</span>}</td>
                  <td>{f.enviado_at ? dur(f.en_proceso_at, f.enviado_at) : <span className="sub">—</span>}</td>
                  <td>
                    {["pendiente", "programado"].includes(f.estado) && (
                      <button className="btn primary" disabled={ocupado === f.id} onClick={() => iniciar(f)}>
                        {ocupado === f.id ? "…" : "▶ Iniciar"}
                      </button>
                    )}
                    {["en_proceso", "enviado_parcial"].includes(f.estado) && (
                      <button className="btn primary" onClick={() => setActivo(f)}>✓ Registrar envío</button>
                    )}
                  </td>
                </tr>
              ))}
              {!visibles.length && <tr><td colSpan={7} className="sub">Sin informes en este filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activo && <ModalEnvio fila={activo} onClose={() => setActivo(null)} onHecho={() => { setActivo(null); cargar(); }} />}
    </div>
  );
}

function ModalEnvio({ fila, onClose, onHecho }: { fila: Fila; onClose: () => void; onHecho: () => void }) {
  const [caso, setCaso] = useState(fila.caso_sf ?? "");
  const [estado, setEstado] = useState<"enviado" | "enviado_parcial" | "enviado_posventa">("enviado");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [pendiente, setPendiente] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  const guardar = async () => {
    if (!caso.trim()) { setMsg({ ok: false, texto: "Escribe el número del Caso SF." }); return; }
    setBusy(true); setMsg(null);
    const r = await registrarEnvio({
      informe_id: fila.id, caso_sf: caso.trim(), estado, fecha_envio: fecha,
      informacion_pendiente: estado === "enviado_parcial" ? pendiente : undefined,
    });
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, texto: r.error ?? "No se pudo guardar." }); return; }
    setMsg({
      ok: true,
      texto: r.validado
        ? `Registrado. Caso validado en Salesforce (${r.sf_cliente}).`
        : `Registrado. ⚠️ El caso no se pudo validar${r.sf_cliente ? ` (SF: ${r.sf_cliente})` : ""}.`,
    });
    setTimeout(onHecho, 1200);
  };

  return (
    <div className="modalbg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>Registrar envío</h2>
        <p className="sub">{fila.clientes?.nombre} · {fila.tipo_informe}</p>
        {fila.en_proceso_at && <p className="sub tiny">En proceso desde {desdeHace(fila.en_proceso_at)}</p>}
        <label className="lbl">Caso SF (se valida contra Salesforce)</label>
        <input className="inp" value={caso} onChange={(e) => setCaso(e.target.value)} placeholder="Ej. 26623524" />
        <label className="lbl">Estado</label>
        <select value={estado} onChange={(e) => setEstado(e.target.value as any)}>
          <option value="enviado">Enviado</option>
          <option value="enviado_parcial">Enviado Parcial - Pdte Info Aliado</option>
          <option value="enviado_posventa">Enviado posventa</option>
        </select>
        <label className="lbl">Fecha de envío</label>
        <input className="inp" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        {estado === "enviado_parcial" && (
          <>
            <label className="lbl">Información pendiente</label>
            <input className="inp" value={pendiente} onChange={(e) => setPendiente(e.target.value)} placeholder="Ej. aliado GAMMA" />
          </>
        )}
        {msg && <p className={msg.ok ? "ok" : "err"}>{msg.texto}</p>}
        <div className="row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" onClick={guardar} disabled={busy}>
            {busy ? "Validando en Salesforce…" : "Guardar y validar"}
          </button>
        </div>
      </div>
    </div>
  );
}
