import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reporting Desk · ETB",
  description: "Inventario, programación y productividad de informes ETB.",
};

export const viewport: Viewport = {
  themeColor: "#0098D6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
