"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import type { MetricaAnalista, ResumenPeriodo } from "@/lib/types";

const ETB = "#0098d6";

export default function Tablero({ periodo }: { periodo: string }) {
  const sb = useMemo(() => createClient(), []);
  const [resumen, setResumen] = useState<ResumenPeriodo | null>(null);
  const [porAnalista, setPorAnalista] = useState<MetricaAnalista[]>([]);
  const [porEstado, setPorEstado] = useState<{ estado_nombre: string; total: number; color: string }[]>([]);
  const [porSegmento, setPorSegmento] = useState<{ segmento: string; pct: number; enviados: number; total: number }[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setCargando(true);
      const [r, a, e, seg] = await Promise.all([
        sb.rpc("resumen_periodo", { p_periodo: periodo }).single(),
        sb.from("v_productividad_analista").select("*").eq("periodo", periodo).order("enviados", { ascending: false }),
        sb.from("v_estado_periodo").select("estado_nombre,total,color").eq("periodo", periodo),
        sb.from("v_cumplimiento_segmento").select("segmento,pct,enviados,total").eq("periodo", periodo),
      ]);
      if (!vivo) return;
      setResumen((r.data as ResumenPeriodo) ?? null);
      setPorAnalista((a.data as MetricaAnalista[]) ?? []);
      setPorEstado((e.data as any[]) ?? []);
      setPorSegmento((seg.data as any[]) ?? []);
      setCargando(false);
    })();
    return () => { vivo = false; };
  }, [sb, periodo]);

  return (
    <>
      <div className="kpis">
        <Kpi n={resumen?.total} l="Informes del período" />
        <Kpi n={resumen?.enviados} l="Enviados" color="var(--good)" />
        <Kpi n={resumen?.programados} l="Programados" color={ETB} />
        <Kpi n={resumen?.pendientes} l="Pendientes" color="var(--warn)" />
        <Kpi n={resumen ? `${resumen.pct_cumplimiento ?? 0}%` : undefined} l="Cumplimiento" />
        <Kpi n={resumen?.casos_validados} l="Casos SF validados" />
      </div>

      <div className="grid2">
        <div className="card">
          <h2>Productividad por analista · enviados</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={porAnalista} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="iniciales" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="enviados" fill={ETB} radius={[4, 4, 0, 0]} name="Enviados" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2>Estado del período</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={porEstado} dataKey="total" nameKey="estado_nombre"
                   innerRadius={60} outerRadius={100} paddingAngle={2}>
                {porEstado.map((s, i) => <Cell key={i} fill={s.color || "#cbd5e1"} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2>Cumplimiento por segmento</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={porSegmento} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="segmento" tick={{ fontSize: 12 }} width={90} />
            <Tooltip />
            <Bar dataKey="pct" fill={ETB} radius={[0, 4, 4, 0]} name="% cumplimiento" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h2>Detalle por analista</h2>
        {cargando ? <p className="sub">Cargando…</p> : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Analista</th><th>Total</th><th>Enviados</th><th>Programados</th>
                  <th>Pendientes</th><th>Parciales</th><th>Casos válidos</th><th>Cumplimiento</th>
                </tr>
              </thead>
              <tbody>
                {porAnalista.map((a) => (
                  <tr key={a.analista_id}>
                    <td><strong>{a.iniciales}</strong> · {a.nombre} {a.apellido ?? ""}</td>
                    <td>{a.total}</td><td>{a.enviados}</td><td>{a.programados}</td>
                    <td>{a.pendientes}</td><td>{a.parciales}</td>
                    <td>{a.casos_validados}/{a.con_caso}</td>
                    <td>{a.pct_cumplimiento ?? 0}%</td>
                  </tr>
                ))}
                {!porAnalista.length && (
                  <tr><td colSpan={8} className="sub">Sin informes en este período.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
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
