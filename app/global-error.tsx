"use client";
// Captura errores incluso del layout raíz (última red de seguridad).
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <div style={{ maxWidth: 560, border: "1px solid #e2e8f0", borderRadius: 14, padding: 24 }}>
            <h1 style={{ fontSize: 18 }}>Error al iniciar la aplicación</h1>
            <pre style={{ background: "#f8fafc", borderRadius: 8, padding: 12, fontSize: 12,
              whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#b91c1c" }}>
              {error?.message || "Error desconocido"}{error?.digest ? `\n\nDigest: ${error.digest}` : ""}
            </pre>
          </div>
        </div>
      </body>
    </html>
  );
}
