"use client";
import { useState } from "react";
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

export default function Dashboard({ perfil }: { perfil: Usuario }) {
  const [mes, setMes] = useState(mesActual());
  const periodo = `${mes}-01`;
  const puedeGestionar = ["coordinador", "superadmin"].includes(perfil.rol);
  const esAnalista = perfil.rol === "analista";
  const [tab, setTab] = useState<Tab>(esAnalista ? "bandeja" : "tablero");

  return (
    <div className="shell">
      <div className="topbar">
        <h1>
          <span className="brandmark" style={{ width: 34, height: 34, fontSize: 14 }}>RD</span>
          Reporting Desk
          <span className="pill">{perfil.rol}</span>
        </h1>
        <div className="row" style={{ alignItems: "center" }}>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          <span className="sub">{perfil.nombre} {perfil.apellido ?? ""} ({perfil.iniciales})</span>
          <form action={logout}><button className="btn">Salir</button></form>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "tablero" ? "on" : ""}`} onClick={() => setTab("tablero")}>Tablero</button>
        {esAnalista && <button className={`tab ${tab === "bandeja" ? "on" : ""}`} onClick={() => setTab("bandeja")}>Mi bandeja</button>}
        {puedeGestionar && <button className={`tab ${tab === "programacion" ? "on" : ""}`} onClick={() => setTab("programacion")}>Programación</button>}
      </div>

      {tab === "tablero" && <Tablero periodo={periodo} />}
      {tab === "bandeja" && esAnalista && <Bandeja perfil={perfil} periodo={periodo} />}
      {tab === "programacion" && puedeGestionar && <Programacion periodo={periodo} />}
    </div>
  );
}
