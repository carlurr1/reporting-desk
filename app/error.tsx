"use client";
// Red de seguridad: si un componente del tablero falla, mostramos el error
// en pantalla (en vez de una página en blanco) para poder diagnosticarlo.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ maxWidth: 560, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 24 }}>
        <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>Ocurrió un error al cargar el tablero</h1>
        <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 12px" }}>
          Copia este mensaje para diagnosticarlo:
        </p>
        <pre style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8,
          padding: 12, fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#b91c1c" }}>
          {error?.message || "Error desconocido"}{error?.digest ? `\n\nDigest: ${error.digest}` : ""}
        </pre>
        <button onClick={reset} style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10,
          border: "1px solid #0098d6", background: "#0098d6", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
          Reintentar
        </button>
      </div>
    </div>
  );
}
