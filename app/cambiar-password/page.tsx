"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CambiarPassword() {
  const router = useRouter();
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const guardar = async () => {
    setErr("");
    if (p1.length < 8) { setErr("La contraseña debe tener al menos 8 caracteres."); return; }
    if (p1 !== p2) { setErr("Las contraseñas no coinciden."); return; }
    setBusy(true);
    try {
      const sb = createClient();
      const { error } = await sb.auth.updateUser({ password: p1 });
      if (error) { setErr(error.message); setBusy(false); return; }
      router.push("/");
      router.refresh();
    } catch (e: any) { setErr(e?.message ?? "Error al guardar"); setBusy(false); }
  };

  return (
    <div className="loginwrap">
      <div className="loginbox">
        <h1 style={{ fontSize: 18, marginTop: 0 }}>Crea tu contraseña</h1>
        <p className="sub">Define una contraseña nueva para tu cuenta.</p>
        <div className="login-form">
          <label className="lbl">Nueva contraseña</label>
          <input className="inp" type="password" value={p1} onChange={(e) => setP1(e.target.value)} placeholder="Mínimo 8 caracteres" />
          <label className="lbl">Confirmar</label>
          <input className="inp" type="password" value={p2} onChange={(e) => setP2(e.target.value)}
                 onKeyDown={(e) => e.key === "Enter" && guardar()} placeholder="Repite la contraseña" />
          {err && <p className="err">{err}</p>}
          <button className="btn primary block" onClick={guardar} disabled={busy}>
            {busy ? "Guardando…" : "Guardar y entrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
