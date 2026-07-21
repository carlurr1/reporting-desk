import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Dashboard from "@/components/Dashboard";
import type { Usuario } from "@/lib/types";

// Punto de entrada autenticado. Resuelve el perfil en el servidor y
// entrega el rol al Dashboard, que decide qué se puede ver/editar.
export default async function Home() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil, error } = await sb.from("usuarios").select("*").eq("id", user.id).single();

  // Sesión válida pero SIN perfil (o error al leerlo): NO redirigimos a /login
  // —eso genera un bucle infinito—; mostramos un mensaje claro con la solución.
  if (!perfil) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{ maxWidth: 520, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 24 }}>
          <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>Tu usuario no tiene perfil</h1>
          <p style={{ color: "#64748b", fontSize: 14 }}>
            Iniciaste sesión (<b>{user.email}</b>) pero no existe una fila en la tabla
            <code> usuarios</code> para tu cuenta. Créala en Supabase (SQL Editor) y recarga.
          </p>
          {error && (
            <pre style={{ background: "#f8fafc", borderRadius: 8, padding: 10, fontSize: 12,
              whiteSpace: "pre-wrap", color: "#b91c1c" }}>{error.message}</pre>
          )}
          <form action="/auth/signout" method="post" style={{ marginTop: 12 }}>
            <a href="/login" style={{ color: "#0098d6", fontSize: 13 }}>← Volver al inicio de sesión</a>
          </form>
        </div>
      </div>
    );
  }
  if (perfil.bloqueado) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <p>Tu cuenta está bloqueada. Contacta a tu coordinador.</p>
      </div>
    );
  }

  return <Dashboard perfil={perfil as Usuario} />;
}
