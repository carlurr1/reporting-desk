"use client";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Inbox, CalendarRange, Upload, ChevronLeft, ChevronDown, LogOut,
} from "lucide-react";
import { logout } from "@/app/login/actions";
import Tablero from "./Tablero";
import Bandeja from "./Bandeja";
import Programacion from "./Programacion";
import type { Usuario } from "@/lib/types";

function mesActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type Tab = "tablero" | "bandeja" | "programacion";
const TITULO: Record<Tab, { t: string; s: string }> = {
  tablero: { t: "Tablero", s: "métricas y productividad del período" },
  bandeja: { t: "Mi bandeja", s: "gestiona y envía tus informes" },
  programacion: { t: "Programación", s: "plan de informes por cliente" },
};

export default function Dashboard({ perfil }: { perfil: Usuario }) {
  const [mes, setMes] = useState(mesActual());
  const periodo = `${mes}-01`;
  const puedeGestionar = ["coordinador", "superadmin"].includes(perfil.rol);
  const esAnalista = perfil.rol === "analista";
  const [tab, setTab] = useState<Tab>(esAnalista ? "bandeja" : "tablero");
  const [colapsado, setColapsado] = useState(false);
  const [menuRol, setMenuRol] = useState(false);

  // Auto-colapsa en pantallas angostas.
  useEffect(() => {
    const f = () => setColapsado(window.innerWidth < 1180);
    f(); window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);

  const nav: { key: Tab; label: string; icon: any; show: boolean }[] = [
    { key: "tablero", label: "Tablero", icon: LayoutDashboard, show: true },
    { key: "bandeja", label: "Mi bandeja", icon: Inbox, show: esAnalista },
    { key: "programacion", label: "Programación", icon: CalendarRange, show: puedeGestionar },
  ];
  const iniciales = perfil.iniciales || (perfil.nombre?.[0] ?? "") + (perfil.apellido?.[0] ?? "");

  return (
    <div className="app" style={{ ["--sw" as any]: colapsado ? "76px" : "232px" }}>
      <aside className="sidebar">
        <div className="side-logo" style={{ justifyContent: colapsado ? "center" : "flex-start" }}>
          <span className="brandmark">RD</span>
          {!colapsado && <span className="wm">Reporting Desk</span>}
        </div>

        <nav className="side-sec">
          {!colapsado && <div className="sec-t">Workspace</div>}
          {nav.filter((n) => n.show).map((n) => (
            <div key={n.key} className={`navitem ${tab === n.key ? "on" : ""}`} title={n.label}
              onClick={() => setTab(n.key)} style={{ justifyContent: colapsado ? "center" : "flex-start" }}>
              <n.icon size={16} />{!colapsado && <span>{n.label}</span>}
            </div>
          ))}
          {perfil.rol === "superadmin" && (
            <a className="navitem" href="/importar" title="Importar"
              style={{ justifyContent: colapsado ? "center" : "flex-start", textDecoration: "none" }}>
              <Upload size={16} />{!colapsado && <span>Importar</span>}
            </a>
          )}
        </nav>

        <div className="usercard-wrap">
          <div className="usercard" onClick={() => setMenuRol((v) => !v)}>
            <span className="av">{iniciales}</span>
            {!colapsado && (
              <>
                <div style={{ overflow: "hidden", lineHeight: 1.25 }}>
                  <div className="nm">{perfil.nombre} {perfil.apellido ?? ""}</div>
                  <div className="rl">{perfil.rol}</div>
                </div>
                <ChevronDown size={14} color="#5c667a" style={{ marginLeft: "auto", flex: "none" }} />
              </>
            )}
          </div>
          {menuRol && (
            <div className="rolemenu">
              <form action={logout}><button type="submit" className="danger" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <LogOut size={14} /> Salir
              </button></form>
            </div>
          )}
        </div>

        <div className="collapse-btn" onClick={() => setColapsado((v) => !v)}>
          <ChevronLeft size={11} style={{ transform: colapsado ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <h1 className="pagetitle">{TITULO[tab].t}</h1>
            <p className="pagesub">{mes} · {TITULO[tab].s}</p>
          </div>
          <div className="row" style={{ alignItems: "center" }}>
            <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          </div>
        </div>

        <div key={tab} style={{ animation: "rise .35s ease both" }}>
          {tab === "tablero" && <Tablero periodo={periodo} puedeValidar={puedeGestionar} />}
          {tab === "bandeja" && esAnalista && <Bandeja perfil={perfil} periodo={periodo} />}
          {tab === "programacion" && puedeGestionar && <Programacion periodo={periodo} />}
        </div>
      </main>
    </div>
  );
}
