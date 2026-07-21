import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Importar from "@/components/Importar";

export default async function ImportarPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: perfil } = await sb.from("usuarios").select("rol, nombre").eq("id", user.id).single();
  if (!perfil || perfil.rol !== "superadmin") {
    return (
      <div className="shell">
        <p className="sub">Solo el superadmin puede importar datos.</p>
        <Link href="/" className="linkbtn">← Volver</Link>
      </div>
    );
  }
  return (
    <div className="shell">
      <div className="topbar">
        <h1><span className="brandmark" style={{ width: 34, height: 34, fontSize: 14 }}>RD</span> Importar</h1>
        <Link href="/" className="btn">← Volver al tablero</Link>
      </div>
      <Importar />
    </div>
  );
}
