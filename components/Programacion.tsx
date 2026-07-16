"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { generarPeriodo } from "@/app/actions";

type Prog = {
  id: string; cliente_id: string; tipo_informe: string | null; frecuencia: string;
  semana_emision: number | null; area_emite: string | null; analista_id: string | null;
  activo: boolean; clientes: { nombre: string; segmento: string | null } | null;
};
type Cliente = { id: string; nombre: string; segmento: string | null };
type Analista = { id: string; iniciales: string | null; nombre: string };

export default function Programacion({ periodo }: { periodo: string }) {
  const sb = useMemo(() => createClient(), []);
  const [progs, setProgs] = useState<Prog[]>([]);
  const [tipos, setTipos] = useState<string[]>([]);
  const [analistas, setAnalistas] = useState<Analista[]>([]);
  const [q, setQ] = useState("");
  const [cargando, setCargando] = useState(true);
  const [nuevo, setNuevo] = useState(false);
  const [msg, setMsg] = useState("");

  const cargar = async () => {
    setCargando(true);
    const [p, t, a] = await Promise.all([
      sb.from("programaciones").select("id,cliente_id,tipo_informe,frecuencia,semana_emision,area_emite,analista_id,activo,clientes(nombre,segmento)").eq("activo", true).limit(500),
      sb.from("tipos_informe").select("nombre").eq("aplica", true).order("orden"),
      sb.from("usuarios").select("id,iniciales,nombre").eq("activo", true).order("iniciales"),
    ]);
    setProgs((p.data as any) ?? []);
    setTipos(((t.data as any[]) ?? []).map((x) => x.nombre));
    setAnalistas((a.data as any) ?? []);
    setCargando(false);
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [sb]);

  const generar = async () => {
    setMsg("Generando período…");
    const r = await generarPeriodo(periodo);
    setMsg(r.ok ? `Período generado: ${r.creados} informes creados.` : `Error: ${r.error}`);
  };

  const reasignar = async (id: string, analista_id: string) => {
    await sb.from("programaciones").update({ analista_id: analista_id || null }).eq("id", id);
    cargar();
  };

  const visibles = progs.filter((p) =>
    !q || p.clientes?.nombre?.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Programación · {progs.length} activas</h2>
        <div className="row" style={{ alignItems: "center" }}>
          <input className="inp" placeholder="Buscar cliente…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 200 }} />
          <button className="btn" onClick={() => setNuevo(true)}>+ Nueva</button>
          <button className="btn primary" onClick={generar}>Generar período {periodo.slice(0, 7)}</button>
        </div>
      </div>
      {msg && <p className="ok" style={{ marginTop: 0 }}>{msg}</p>}

      {cargando ? <p className="sub">Cargando…</p> : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr><th>Cliente</th><th>Segmento</th><th>Tipo</th><th>Frecuencia</th><th>Semana</th><th>Área</th><th>Analista</th></tr>
            </thead>
            <tbody>
              {visibles.slice(0, 200).map((p) => (
                <tr key={p.id}>
                  <td>{p.clientes?.nombre ?? "—"}</td>
                  <td className="sub">{p.clientes?.segmento ?? ""}</td>
                  <td>{p.tipo_informe ?? "—"}</td>
                  <td>{p.frecuencia}</td>
                  <td>{p.semana_emision ?? "—"}</td>
                  <td>{p.area_emite ?? "—"}</td>
                  <td>
                    <select value={p.analista_id ?? ""} onChange={(e) => reasignar(p.id, e.target.value)}>
                      <option value="">— sin asignar —</option>
                      {analistas.map((a) => <option key={a.id} value={a.id}>{a.iniciales} · {a.nombre}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
              {!visibles.length && <tr><td colSpan={7} className="sub">Sin programaciones. Crea una o importa desde el Excel.</td></tr>}
            </tbody>
          </table>
          {visibles.length > 200 && <p className="sub tiny">Mostrando 200 de {visibles.length}. Usa el buscador para acotar.</p>}
        </div>
      )}

      {nuevo && <ModalNueva tipos={tipos} analistas={analistas} onClose={() => setNuevo(false)} onHecho={() => { setNuevo(false); cargar(); }} />}
    </div>
  );
}

function ModalNueva({ tipos, analistas, onClose, onHecho }:
  { tipos: string[]; analistas: Analista[]; onClose: () => void; onHecho: () => void }) {
  const sb = useMemo(() => createClient(), []);
  const [busq, setBusq] = useState("");
  const [opciones, setOpciones] = useState<Cliente[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [tipo, setTipo] = useState(tipos[0] ?? "");
  const [frecuencia, setFrecuencia] = useState("Mensual");
  const [semana, setSemana] = useState("1");
  const [area, setArea] = useState("Reporting");
  const [analista, setAnalista] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (busq.length < 3) { setOpciones([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb.from("clientes").select("id,nombre,segmento").ilike("nombre", `%${busq}%`).limit(10);
      setOpciones((data as any) ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [busq, sb]);

  const guardar = async () => {
    if (!cliente) { setMsg("Selecciona un cliente."); return; }
    const { error } = await sb.from("programaciones").insert({
      cliente_id: cliente.id, tipo_informe: tipo, frecuencia,
      semana_emision: Number(semana), area_emite: area, analista_id: analista || null,
    });
    if (error) { setMsg(error.message); return; }
    onHecho();
  };

  return (
    <div className="modalbg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>Nueva programación</h2>
        <label className="lbl">Cliente</label>
        {cliente ? (
          <div className="row" style={{ alignItems: "center" }}>
            <strong>{cliente.nombre}</strong>
            <button className="linkbtn" onClick={() => setCliente(null)}>cambiar</button>
          </div>
        ) : (
          <>
            <input className="inp" placeholder="Escribe 3+ letras…" value={busq} onChange={(e) => setBusq(e.target.value)} />
            {opciones.map((o) => (
              <div key={o.id} className="opt" onClick={() => { setCliente(o); setOpciones([]); setBusq(""); }}>
                {o.nombre} <span className="sub">· {o.segmento}</span>
              </div>
            ))}
          </>
        )}
        <label className="lbl">Tipo de informe</label>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>{tipos.map((t) => <option key={t}>{t}</option>)}</select>
        <div className="row">
          <div style={{ flex: 1 }}>
            <label className="lbl">Frecuencia</label>
            <select value={frecuencia} onChange={(e) => setFrecuencia(e.target.value)}>
              <option>Mensual</option><option>Semanal</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="lbl">Semana</label>
            <select value={semana} onChange={(e) => setSemana(e.target.value)}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <div className="row">
          <div style={{ flex: 1 }}>
            <label className="lbl">Área</label>
            <select value={area} onChange={(e) => setArea(e.target.value)}>
              <option>Reporting</option><option>InformesHdp</option><option>Posventa</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="lbl">Analista</label>
            <select value={analista} onChange={(e) => setAnalista(e.target.value)}>
              <option value="">— sin asignar —</option>
              {analistas.map((a) => <option key={a.id} value={a.id}>{a.iniciales} · {a.nombre}</option>)}
            </select>
          </div>
        </div>
        {msg && <p className="err">{msg}</p>}
        <div className="row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" onClick={guardar}>Guardar</button>
        </div>
      </div>
    </div>
  );
}
