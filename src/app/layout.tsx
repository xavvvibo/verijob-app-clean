import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "VERIJOB", template: "%s" },
  description: "Verificación de experiencia y credibilidad profesional.",
  icons: {
    icon: "/brand/verijob-icon.svg",
    shortcut: "/brand/verijob-icon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
