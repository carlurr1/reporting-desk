"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { registrarEnvio } from "@/app/actions";
import type { Usuario } from "@/lib/types";

type Fila = {
  id: string; periodo: string; tipo_informe: string | null; estado: string;
  caso_sf: string | null; fecha_envio: string | null; sf_validado: boolean;
  semana_emision: number | null; informacion_pendiente: string | null;
  clientes: { nombre: string; segmento: string | null; nit: string | null } | null;
};

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente", programado: "Programado",
  enviado_parcial: "Parcial", enviado: "Enviado", enviado_posventa: "Enviado posventa",
};
const ESTADO_COLOR: Record<string, string> = {
  pendiente: "#94a3b8", programado: "#3b82f6",
  enviado_parcial: "#f59e0b", enviado: "#22c55e", enviado_posventa: "#16a34a",
};

export default function Bandeja({ perfil, periodo }: { perfil: Usuario; periodo: string }) {
  const sb = useMemo(() => createClient(), []);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<"todos" | "pendientes" | "enviados">("todos");
  const [activo, setActivo] = useState<Fila | null>(null);

  const cargar = async () => {
    setCargando(true);
    const { data } = await sb
      .from("informes")
      .select("id,periodo,tipo_informe,estado,caso_sf,fecha_envio,sf_validado,semana_emision,informacion_pendiente,clientes(nombre,segmento,nit)")
      .eq("analista_id", perfil.id)
      .eq("periodo", periodo)
      .order("semana_emision", { ascending: true });
    setFilas((data as any) ?? []);
    setCargando(false);
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [sb, periodo, perfil.id]);

  const visibles = filas.filter((f) =>
    filtro === "todos" ? true :
    filtro === "enviados" ? ["enviado", "enviado_posventa", "enviado_parcial"].includes(f.estado) :
    ["pendiente", "programado"].includes(f.estado));

  const pendientes = filas.filter((f) => ["pendiente", "programado"].includes(f.estado)).length;

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Mi bandeja · {filas.length} informes · {pendientes} por enviar</h2>
        <select value={filtro} onChange={(e) => setFiltro(e.target.value as any)}>
          <option value="todos">Todos</option>
          <option value="pendientes">Por enviar</option>
          <option value="enviados">Enviados</option>
        </select>
      </div>

      {cargando ? <p className="sub">Cargando…</p> : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Cliente</th><th>Segmento</th><th>Sem.</th><th>Tipo</th>
                <th>Estado</th><th>Caso SF</th><th>Envío</th><th></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => (
                <tr key={f.id}>
                  <td>{f.clientes?.nombre ?? "—"}</td>
                  <td className="sub">{f.clientes?.segmento ?? ""}</td>
                  <td>{f.semana_emision ?? "—"}</td>
                  <td>{f.tipo_informe ?? "—"}</td>
                  <td><span className="badge" style={{ background: ESTADO_COLOR[f.estado] ?? "#94a3b8" }}>{ESTADO_LABEL[f.estado] ?? f.estado}</span></td>
                  <td>
                    {f.caso_sf ? (
                      <span title={f.sf_validado ? "Caso validado en Salesforce" : "Caso sin validar"}>
                        {f.caso_sf} {f.sf_validado ? "✅" : "⚠️"}
                      </span>
                    ) : <span className="sub">—</span>}
                  </td>
                  <td className="sub">{f.fecha_envio ?? "—"}</td>
                  <td>
                    {["pendiente", "programado", "enviado_parcial"].includes(f.estado) &&
                      <button className="btn" onClick={() => setActivo(f)}>Registrar envío</button>}
                  </td>
                </tr>
              ))}
              {!visibles.length && <tr><td colSpan={8} className="sub">Sin informes en este filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activo && (
        <ModalEnvio fila={activo} onClose={() => setActivo(null)} onHecho={() => { setActivo(null); cargar(); }} />
      )}
    </div>
  );
}

function ModalEnvio({ fila, onClose, onHecho }:
  { fila: Fila; onClose: () => void; onHecho: () => void }) {
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
        : `Registrado. ⚠️ El caso no se pudo validar contra el cliente${r.sf_cliente ? ` (SF: ${r.sf_cliente})` : ""}.`,
    });
    setTimeout(onHecho, 1200);
  };

  return (
    <div className="modalbg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>Registrar envío</h2>
        <p className="sub">{fila.clientes?.nombre} · {fila.tipo_informe}</p>
        <label className="lbl">Caso SF (caso informativo)</label>
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
