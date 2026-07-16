"use client";
import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <div className="loginwrap">
      <div className="loginbox">
        <div className="brand">
          <span className="brandmark">RD</span>
          <div>
            <h1>Reporting Desk</h1>
            <p className="sub">Inventario y programación de informes · ETB</p>
          </div>
        </div>
        <form action={action} className="login-form">
          <label className="lbl">Usuario</label>
          <input className="inp" name="usuario" placeholder="Usuario o iniciales" autoComplete="username" />
          <label className="lbl">Contraseña</label>
          <input className="inp" name="password" type="password" placeholder="••••••••" autoComplete="current-password" />
          {state?.error && <p className="err">{state.error}</p>}
          <button className="btn primary block" type="submit" disabled={pending}>
            {pending ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <p className="sub tiny">Acceso seguro · El histórico de cambios queda auditado.</p>
      </div>
    </div>
  );
}
