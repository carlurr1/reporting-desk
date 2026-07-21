"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { createClient } from "@/lib/supabase/client";

const ETB = "#0098d6";

const EST = {
  pendiente:        { label: "Pendiente",  color: "#94a3b8" },
  programado:       { label: "Programado", color: "#3b82f6" },
  en_proceso:       { label: "En proceso", color: "#8b5cf6" },
  enviado_parcial:  { label: "Parcial",    color: "#f59e0b" },
  enviado:          { label: "Enviado",    color: "#22c55e" },
  enviado_posventa: { label: "Enviado posventa", color: "#16a34a" },
} as const;
const ESTADOS = Object.keys(EST) as (keyof typeof EST)[];
const esFinal = (e: string) => e === "enviado" || e === "enviado_posventa";

type Row = {
  id: string; estado: string; tipo_informe: string | null; area_emite: string | null;
  semana_emision: number | null; caso_sf: string | null; sf_validado: boolean;
  cliente: string; segmento: string; analista: string;
  en_proceso_at: string | null; enviado_at: string | null;
};

export default function Tablero({ periodo }: { periodo: string }) {
  const sb = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [tend, setTend] = useState<{ mes: string; enviados: number; total: number }[]>([]);
  const [cargando, setCargando] = useState(true);

  const [fAna, setFAna] = useState<string[]>([]);
  const [fSeg, setFSeg] = useState<string[]>([]);
  const [fArea, setFArea] = useState<string[]>([]);
  const [fEst, setFEst] = useState<string[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    let vivo = true;
    (async () => {
      setCargando(true);
      const { data: us } = await sb.from("usuarios").select("id, iniciales");
      const mapU = new Map((us ?? []).map((u: any) => [u.id, u.iniciales]));

      const acc: any[] = [];
      for (let desde = 0; ; desde += 1000) {
        const { data } = await sb.from("informes")
          .select("id,estado,tipo_informe,area_emite,semana_emision,caso_sf,sf_validado,en_proceso_at,enviado_at,analista_id,clientes(nombre,segmento)")
          .eq("periodo", periodo).range(desde, desde + 999);
        if (!data?.length) break;
        acc.push(...data);
        if (data.length < 1000) break;
      }
      if (!vivo) return;
      setRows(acc.map((r: any) => ({
        id: r.id, estado: r.estado, tipo_informe: r.tipo_informe, area_emite: r.area_emite,
        semana_emision: r.semana_emision, caso_sf: r.caso_sf, sf_validado: r.sf_validado,
        en_proceso_at: r.en_proceso_at, enviado_at: r.enviado_at,
        cliente: r.clientes?.nombre ?? "—", segmento: r.clientes?.segmento ?? "—",
        analista: (r.analista_id && mapU.get(r.analista_id)) || "—",
      })));

      const { data: t } = await sb.from("v_tendencia_mensual").select("periodo,total,enviados").order("periodo");
      if (!vivo) return;
      setTend((t ?? []).map((x: any) => ({ mes: String(x.periodo).slice(0, 7), enviados: x.enviados, total: x.total })));
      setCargando(false);
    })();
    return () => { vivo = false; };
  }, [sb, periodo]);

  const opts = useMemo(() => ({
    ana: [...new Set(rows.map((r) => r.analista))].filter((x) => x !== "—").sort(),
    seg: [...new Set(rows.map((r) => r.segmento))].filter((x) => x !== "—").sort(),
    area: [...new Set(rows.map((r) => r.area_emite ?? "—"))].filter(Boolean).sort() as string[],
  }), [rows]);

  const fil = useMemo(() => rows.filter((r) =>
    (!fAna.length || fAna.includes(r.analista)) &&
    (!fSeg.length || fSeg.includes(r.segmento)) &&
    (!fArea.length || fArea.includes(r.area_emite ?? "—")) &&
    (!fEst.length || fEst.includes(r.estado))
  ), [rows, fAna, fSeg, fArea, fEst]);

  const kpis = useMemo(() => {
    const total = fil.length;
    const enviados = fil.filter((r) => esFinal(r.estado)).length;
    const pendientes = fil.filter((r) => r.estado === "pendiente" || r.estado === "programado").length;
    const validados = fil.filter((r) => r.sf_validado).length;
    const clientes = new Set(fil.map((r) => r.cliente)).size;
    const pct = total ? Math.round((enviados / total) * 1000) / 10 : 0;
    // Tiempo promedio de gestión (en_proceso → enviado), en horas.
    const tiempos = fil.filter((r) => r.en_proceso_at && r.enviado_at)
      .map((r) => (new Date(r.enviado_at!).getTime() - new Date(r.en_proceso_at!).getTime()) / 3600000)
      .filter((h) => h >= 0);
    const horasProm = tiempos.length ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length * 10) / 10 : null;
    return { total, enviados, pendientes, validados, clientes, pct, horasProm };
  }, [fil]);

  const porAnalista = useMemo(() => {
    const m = new Map<string, any>();
    for (const r of fil) {
      if (!m.has(r.analista)) m.set(r.analista, { iniciales: r.analista, pendiente: 0, programado: 0, enviado_parcial: 0, enviado: 0, enviado_posventa: 0, total: 0 });
      const o = m.get(r.analista); o[r.estado] = (o[r.estado] ?? 0) + 1; o.total++;
    }
    return [...m.values()].filter((x) => x.iniciales !== "—").sort((a, b) => b.total - a.total);
  }, [fil]);

  const porEstado = useMemo(() =>
    ESTADOS.map((e) => ({ estado: EST[e].label, total: fil.filter((r) => r.estado === e).length, color: EST[e].color }))
      .filter((x) => x.total > 0), [fil]);

  const porSegmento = useMemo(() => {
    const m = new Map<string, { segmento: string; total: number; enviados: number }>();
    for (const r of fil) {
      if (!m.has(r.segmento)) m.set(r.segmento, { segmento: r.segmento, total: 0, enviados: 0 });
      const o = m.get(r.segmento)!; o.total++; if (esFinal(r.estado)) o.enviados++;
    }
    return [...m.values()].map((o) => ({ ...o, pct: o.total ? Math.round((o.enviados / o.total) * 1000) / 10 : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [fil]);

  const porSemana = useMemo(() =>
    [1, 2, 3, 4, 5].map((s) => ({ semana: `Sem ${s}`, total: fil.filter((r) => r.semana_emision === s).length })), [fil]);

  const topClientes = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of fil) m.set(r.cliente, (m.get(r.cliente) ?? 0) + 1);
    return [...m.entries()].map(([cliente, total]) => ({ cliente, total }))
      .sort((a, b) => b.total - a.total).slice(0, 10);
  }, [fil]);

  const casos = useMemo(() => {
    const env = fil.filter((r) => esFinal(r.estado));
    return [
      { n: "Validado", total: env.filter((r) => r.sf_validado).length, color: "#22c55e" },
      { n: "Caso sin validar", total: env.filter((r) => r.caso_sf && !r.sf_validado).length, color: "#f59e0b" },
      { n: "Sin caso", total: env.filter((r) => !r.caso_sf).length, color: "#ef4444" },
    ].filter((x) => x.total > 0);
  }, [fil]);

  const tabla = useMemo(() =>
    fil.filter((r) => !q || r.cliente.toLowerCase().includes(q.toLowerCase())).slice(0, 200), [fil, q]);

  return (
    <>
      <div className="filtros">
        <FiltroChips titulo="Analista" opciones={opts.ana} sel={fAna} setSel={setFAna} />
        <FiltroChips titulo="Segmento" opciones={opts.seg} sel={fSeg} setSel={setFSeg} />
        <FiltroChips titulo="Área" opciones={opts.area} sel={fArea} setSel={setFArea} />
        <FiltroChips titulo="Estado" opciones={ESTADOS as unknown as string[]} sel={fEst} setSel={setFEst}
          etiqueta={(e) => (EST as any)[e]?.label ?? e} />
        {(fAna.length || fSeg.length || fArea.length || fEst.length) ? (
          <button className="btn" style={{ alignSelf: "center" }}
            onClick={() => { setFAna([]); setFSeg([]); setFArea([]); setFEst([]); }}>Limpiar</button>
        ) : null}
      </div>

      <div className="kpis">
        <Kpi n={kpis.total} l="Informes" />
        <Kpi n={kpis.enviados} l="Enviados" color="var(--good)" />
        <Kpi n={kpis.pendientes} l="Por enviar" color="var(--warn)" />
        <Kpi n={`${kpis.pct}%`} l="Cumplimiento" />
        <Kpi n={kpis.horasProm != null ? `${kpis.horasProm} h` : "—"} l="Tiempo prom. gestión" />
        <Kpi n={kpis.clientes} l="Clientes cubiertos" />
        <Kpi n={kpis.validados} l="Casos SF validados" />
      </div>

      {cargando && <p className="sub">Cargando datos…</p>}

      <div className="grid2">
        <div className="card">
          <h2>Productividad por analista</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={porAnalista} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="iniciales" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip /><Legend />
              {ESTADOS.map((e) => (
                <Bar key={e} dataKey={e} stackId="a" fill={EST[e].color} name={EST[e].label}
                  radius={e === "enviado_posventa" ? [4, 4, 0, 0] : undefined} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2>Estado del período</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={porEstado} dataKey="total" nameKey="estado" innerRadius={65} outerRadius={105} paddingAngle={2}>
                {porEstado.map((s, i) => <Cell key={i} fill={s.color} />)}
              </Pie>
              <Legend /><Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2>Top 10 clientes · nº de informes</h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={topClientes} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
              <YAxis type="category" dataKey="cliente" tick={{ fontSize: 10 }} width={150}
                tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 20) + "…" : v} />
              <Tooltip />
              <Bar dataKey="total" fill={ETB} radius={[0, 4, 4, 0]} name="Informes" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2>Cumplimiento por segmento</h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={porSegmento} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="segmento" tick={{ fontSize: 12 }} width={90} />
              <Tooltip />
              <Bar dataKey="pct" fill="#029E73" radius={[0, 4, 4, 0]} name="% cumplimiento" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2>Tendencia mensual · enviados</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={tend} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="enviados" stroke={ETB} strokeWidth={2} dot={{ r: 3 }} name="Enviados" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2>Casos Salesforce · control</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={casos} dataKey="total" nameKey="n" innerRadius={55} outerRadius={95} paddingAngle={2}>
                {casos.map((s, i) => <Cell key={i} fill={s.color} />)}
              </Pie>
              <Legend /><Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2>Distribución por semana de emisión</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={porSemana}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
            <XAxis dataKey="semana" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="total" fill={ETB} radius={[4, 4, 0, 0]} name="Informes" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Detalle por cliente · {tabla.length}{fil.length > 200 ? ` de ${fil.length}` : ""}</h2>
          <input className="inp" placeholder="Buscar cliente…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 240 }} />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr><th>Cliente</th><th>Segmento</th><th>Analista</th><th>Tipo</th><th>Área</th><th>Estado</th><th>Caso SF</th></tr>
            </thead>
            <tbody>
              {tabla.map((r) => (
                <tr key={r.id}>
                  <td>{r.cliente}</td>
                  <td className="sub">{r.segmento}</td>
                  <td>{r.analista}</td>
                  <td>{r.tipo_informe ?? "—"}</td>
                  <td className="sub">{r.area_emite ?? "—"}</td>
                  <td><span className="badge" style={{ background: (EST as any)[r.estado]?.color ?? "#94a3b8" }}>
                    {(EST as any)[r.estado]?.label ?? r.estado}</span></td>
                  <td>{r.caso_sf ? <>{r.caso_sf} {r.sf_validado ? "✅" : "⚠️"}</> : <span className="sub">—</span>}</td>
                </tr>
              ))}
              {!tabla.length && <tr><td colSpan={7} className="sub">Sin informes con estos filtros.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Kpi({ n, l, color }: { n?: number | string; l: string; color?: string }) {
  return (
    <div className="kpi">
      <div className="n" style={color ? { color } : undefined}>{n ?? "—"}</div>
      <div className="l">{l}</div>
    </div>
  );
}

function FiltroChips({ titulo, opciones, sel, setSel, etiqueta }: {
  titulo: string; opciones: string[]; sel: string[]; setSel: (v: string[]) => void; etiqueta?: (o: string) => string;
}) {
  if (!opciones.length) return null;
  const toggle = (o: string) => setSel(sel.includes(o) ? sel.filter((x) => x !== o) : [...sel, o]);
  return (
    <div className="filtrogrupo">
      <span className="filtrotit">{titulo}</span>
      <div className="chips">
        {opciones.map((o) => (
          <button key={o} className={`chip ${sel.includes(o) ? "on" : ""}`} onClick={() => toggle(o)}>
            {etiqueta ? etiqueta(o) : o}
          </button>
        ))}
      </div>
    </div>
  );
}
