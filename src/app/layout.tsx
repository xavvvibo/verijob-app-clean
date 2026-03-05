import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "VERIJOB", template: "VERIJOB — %s" },
  description: "Verificación de experiencia y credibilidad profesional.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
