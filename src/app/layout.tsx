import type { Metadata } from "next";
import Ga4Client from "@/components/analytics/Ga4Client";
import CookieConsentBanner from "@/components/privacy/CookieConsentBanner";
import "./globals.css";
import ClientRuntimeGuard from "@/components/runtime/ClientRuntimeGuard";

export const metadata: Metadata = {
  title: { default: "VERIJOB", template: "%s" },
  description: "Verificación de experiencia y credibilidad profesional.",
  icons: {
    icon: "/brand/verijob-favicon-tick.ico",
    shortcut: "/brand/verijob-favicon-tick.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ClientRuntimeGuard />
        <Ga4Client />
        <CookieConsentBanner />
        {children}
      </body>
    </html>
  );
}
