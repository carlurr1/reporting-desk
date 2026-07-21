"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, Area, AreaChart, Label,
} from "recharts";
import {
  FileText, Send, Clock3, Target, Users, ShieldCheck, TrendingUp, PieChart as PieIcon,
  BarChart3, Building2, CalendarDays, Trophy,
} from "lucide-react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";

const ETB = "#0098d6";

// Grid / ejes discretos, estilo Power BI.
const GRID = "#eef2f7";
const AXIS = { fontSize: 11, fill: "#7688a0" };
const axisLine = false, tickLine = false;

// Tooltip personalizado.
function TT({ active, payload, label, unidad }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tt">
      {label != null && <div className="tt-t">{label}</div>}
      {payload.filter((p: any) => p.value !== 0 && p.value != null).map((p: any, i: number) => (
        <div className="tt-r" key={i}>
          <span className="tt-d" style={{ background: p.color || p.payload?.color || ETB }} />
          {p.name}<span className="tt-v">{p.value}{unidad ?? ""}</span>
        </div>
      ))}
    </div>
  );
}

// Encabezado de tarjeta con icono.
function Head({ icon: Icon, title, sub }: { icon: any; title: string; sub?: string }) {
  return (
    <div className="cardhead">
      <span className="hico"><Icon size={16} /></span>
      <div><h2>{title}</h2>{sub && <p className="sub tiny">{sub}</p>}</div>
    </div>
  );
}

// Total al centro de una dona.
function Centro({ v, total, cap }: { v: any; total: number; cap: string }) {
  if (!v) return null;
  const cx = v.cx, cy = v.cy;
  return (
    <g>
      <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="central"
        style={{ fontSize: 28, fontWeight: 800, fill: "#0b1b2b", letterSpacing: "-1px" }}>{total}</text>
      <text x={cx} y={cy + 18} textAnchor="middle"
        style={{ fontSize: 11, fill: "#7688a0", textTransform: "uppercase", letterSpacing: ".5px" }}>{cap}</text>
    </g>
  );
}

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
      if (!m.has(r.analista)) m.set(r.analista, { iniciales: r.analista, pendiente: 0, programado: 0, en_proceso: 0, enviado_parcial: 0, enviado: 0, enviado_posventa: 0, total: 0, _horas: [] as number[] });
      const o = m.get(r.analista); o[r.estado] = (o[r.estado] ?? 0) + 1; o.total++;
      if (r.en_proceso_at && r.enviado_at) {
        const h = (new Date(r.enviado_at).getTime() - new Date(r.en_proceso_at).getTime()) / 3600000;
        if (h >= 0) o._horas.push(h);
      }
    }
    return [...m.values()].filter((x) => x.iniciales !== "—").map((o) => {
      const enviados = o.enviado + o.enviado_posventa;
      const pendientes = o.pendiente + o.programado;
      return {
        ...o, enviados, pendientes,
        pct: o.total ? Math.round((enviados / o.total) * 1000) / 10 : 0,
        horas: o._horas.length ? Math.round(o._horas.reduce((a: number, b: number) => a + b, 0) / o._horas.length * 10) / 10 : null,
      };
    }).sort((a, b) => b.total - a.total);
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

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    const s1 = XLSX.utils.json_to_sheet(porAnalista.map((a) => ({
      Analista: a.iniciales, Total: a.total, Enviados: a.enviados, "En proceso": a.en_proceso,
      "Por enviar": a.pendientes, "Cumplimiento %": a.pct, "Tiempo prom (h)": a.horas ?? "",
    })));
    XLSX.utils.book_append_sheet(wb, s1, "Por analista");
    const s2 = XLSX.utils.json_to_sheet(fil.map((r) => ({
      Cliente: r.cliente, Segmento: r.segmento, Analista: r.analista, Tipo: r.tipo_informe ?? "",
      Area: r.area_emite ?? "", Estado: (EST as any)[r.estado]?.label ?? r.estado,
      "Caso SF": r.caso_sf ?? "", Validado: r.sf_validado ? "Sí" : "No",
    })));
    XLSX.utils.book_append_sheet(wb, s2, "Detalle");
    XLSX.writeFile(wb, `reporting-desk-${periodo.slice(0, 7)}.xlsx`);
  };

  return (
    <>
      <div className="filtros">
        <FiltroChips titulo="Analista" opciones={opts.ana} sel={fAna} setSel={setFAna} />
        <FiltroChips titulo="Segmento" opciones={opts.seg} sel={fSeg} setSel={setFSeg} />
        <FiltroChips titulo="Área" opciones={opts.area} sel={fArea} setSel={setFArea} />
        <FiltroChips titulo="Estado" opciones={ESTADOS as unknown as string[]} sel={fEst} setSel={setFEst}
          etiqueta={(e) => (EST as any)[e]?.label ?? e} />
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignSelf: "center" }}>
          {(fAna.length || fSeg.length || fArea.length || fEst.length) ? (
            <button className="btn" onClick={() => { setFAna([]); setFSeg([]); setFArea([]); setFEst([]); }}>Limpiar</button>
          ) : null}
          <button className="btn" onClick={exportarExcel} title="Descarga los datos filtrados en Excel">⬇ Excel</button>
          <button className="btn" onClick={() => window.print()} title="Imprime o guarda como PDF/imagen">🖨 PDF</button>
        </div>
      </div>

      <div className="kpis">
        <Kpi icon={FileText}   n={kpis.total} l="Informes" />
        <Kpi icon={Send}       n={kpis.enviados} l="Enviados" />
        <Kpi icon={Clock3}     n={kpis.pendientes} l="Por enviar" />
        <Kpi icon={Target}     n={`${kpis.pct}%`} l="Cumplimiento" />
        <Kpi icon={TrendingUp} n={kpis.horasProm != null ? `${kpis.horasProm} h` : "—"} l="Tiempo prom." />
        <Kpi icon={Building2}  n={kpis.clientes} l="Clientes" />
        <Kpi icon={ShieldCheck} n={kpis.validados} l="Casos validados" />
      </div>

      {cargando && <p className="sub">Cargando datos…</p>}

      <div className="grid2">
        <div className="card">
          <Head icon={BarChart3} title="Productividad por analista" sub="informes por estado" />
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={porAnalista} margin={{ left: -12, right: 8 }} barCategoryGap="22%">
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="iniciales" tick={AXIS} axisLine={axisLine} tickLine={tickLine} />
              <YAxis tick={AXIS} axisLine={axisLine} tickLine={tickLine} allowDecimals={false} width={30} />
              <Tooltip cursor={{ fill: "rgba(0,152,214,.05)" }} content={<TT />} />
              <Legend iconType="circle" iconSize={9} />
              {ESTADOS.map((e, i) => (
                <Bar key={e} dataKey={e} stackId="a" fill={EST[e].color} name={EST[e].label}
                  radius={i === ESTADOS.length - 1 ? [5, 5, 0, 0] : undefined} maxBarSize={46} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <Head icon={PieIcon} title="Estado del período" sub={`${kpis.total} informes`} />
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={porEstado} dataKey="total" nameKey="estado" innerRadius={72} outerRadius={108}
                   paddingAngle={2} cornerRadius={5} stroke="none">
                {porEstado.map((s, i) => <Cell key={i} fill={s.color} />)}
                <Label content={(p: any) => <Centro v={p.viewBox} total={kpis.total} cap="informes" />} />
              </Pie>
              <Legend iconType="circle" iconSize={9} />
              <Tooltip content={<TT />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <Head icon={Trophy} title="Top 10 clientes" sub="por nº de informes" />
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={topClientes} layout="vertical" margin={{ left: 8, right: 12 }}>
              <defs>
                <linearGradient id="gEtb" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#43b3e3" /><stop offset="100%" stopColor={ETB} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" tick={AXIS} axisLine={axisLine} tickLine={tickLine} allowDecimals={false} />
              <YAxis type="category" dataKey="cliente" tick={{ ...AXIS, fontSize: 10 }} axisLine={axisLine} tickLine={tickLine} width={155}
                tickFormatter={(v: string) => v.length > 24 ? v.slice(0, 22) + "…" : v} />
              <Tooltip cursor={{ fill: "rgba(0,152,214,.05)" }} content={<TT />} />
              <Bar dataKey="total" fill="url(#gEtb)" radius={[0, 5, 5, 0]} name="Informes" maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <Head icon={Building2} title="Cumplimiento por segmento" sub="% enviados" />
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={porSegmento} layout="vertical" margin={{ left: 8, right: 12 }}>
              <defs>
                <linearGradient id="gGreen" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#4ade80" /><stop offset="100%" stopColor="#16b364" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} unit="%" tick={AXIS} axisLine={axisLine} tickLine={tickLine} />
              <YAxis type="category" dataKey="segmento" tick={AXIS} axisLine={axisLine} tickLine={tickLine} width={90} />
              <Tooltip cursor={{ fill: "rgba(0,152,214,.05)" }} content={<TT unidad="%" />} />
              <Bar dataKey="pct" fill="url(#gGreen)" radius={[0, 5, 5, 0]} name="Cumplimiento" maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <Head icon={CalendarDays} title="Tendencia mensual" sub="informes enviados" />
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={tend} margin={{ left: -12, right: 8 }}>
              <defs>
                <linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ETB} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={ETB} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="mes" tick={AXIS} axisLine={axisLine} tickLine={tickLine} />
              <YAxis tick={AXIS} axisLine={axisLine} tickLine={tickLine} allowDecimals={false} width={30} />
              <Tooltip content={<TT />} />
              <Area type="monotone" dataKey="enviados" stroke={ETB} strokeWidth={2.5} fill="url(#gArea)"
                dot={{ r: 3, fill: ETB, strokeWidth: 0 }} activeDot={{ r: 5 }} name="Enviados" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <Head icon={ShieldCheck} title="Casos Salesforce" sub="control de calidad" />
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={casos} dataKey="total" nameKey="n" innerRadius={62} outerRadius={96}
                   paddingAngle={2} cornerRadius={5} stroke="none">
                {casos.map((s, i) => <Cell key={i} fill={s.color} />)}
                <Label content={(p: any) => <Centro v={p.viewBox} total={casos.reduce((a, b) => a + b.total, 0)} cap="enviados" />} />
              </Pie>
              <Legend iconType="circle" iconSize={9} />
              <Tooltip content={<TT />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Resumen por analista con porcentajes y tiempo */}
      <div className="card">
        <Head icon={Users} title="Detalle por analista" sub="gestión y cumplimiento" />
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Analista</th><th>Total</th><th>Enviados</th><th>En proceso</th>
                <th>Por enviar</th><th>Cumplimiento</th><th>Tiempo prom.</th>
              </tr>
            </thead>
            <tbody>
              {porAnalista.map((a) => (
                <tr key={a.iniciales}>
                  <td><strong>{a.iniciales}</strong></td>
                  <td>{a.total}</td>
                  <td>{a.enviados}</td>
                  <td>{a.en_proceso}</td>
                  <td>{a.pendientes}</td>
                  <td>
                    <div className="barra"><span style={{ width: `${a.pct}%`, background: a.pct >= 80 ? "var(--good)" : a.pct >= 50 ? "var(--warn)" : "var(--bad)" }} /></div>
                    <span className="tiny">{a.pct}%</span>
                  </td>
                  <td>{a.horas != null ? `${a.horas} h` : "—"}</td>
                </tr>
              ))}
              {!porAnalista.length && <tr><td colSpan={7} className="sub">Sin datos por analista (crea los usuarios y re-importa).</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <Head icon={CalendarDays} title="Distribución por semana de emisión" />
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={porSemana} barCategoryGap="35%">
            <defs>
              <linearGradient id="gEtbV" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#43b3e3" /><stop offset="100%" stopColor={ETB} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="semana" tick={AXIS} axisLine={axisLine} tickLine={tickLine} />
            <YAxis tick={AXIS} axisLine={axisLine} tickLine={tickLine} allowDecimals={false} width={30} />
            <Tooltip cursor={{ fill: "rgba(0,152,214,.05)" }} content={<TT />} />
            <Bar dataKey="total" fill="url(#gEtbV)" radius={[5, 5, 0, 0]} name="Informes" maxBarSize={70} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <div className="cardhead" style={{ justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span className="hico"><FileText size={16} /></span>
            <h2>Detalle por cliente · {tabla.length}{fil.length > 200 ? ` de ${fil.length}` : ""}</h2>
          </div>
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

function Kpi({ n, l, icon: Icon }: { n?: number | string; l: string; icon?: any }) {
  return (
    <div className="kpi">
      {Icon && <span className="ico"><Icon size={19} /></span>}
      <div className="n">{n ?? "—"}</div>
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
