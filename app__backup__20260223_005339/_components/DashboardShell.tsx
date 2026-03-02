"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

export default function DashboardShell({
  title,
  subtitle,
  role,
  nav,
  children,
}: {
  title: string;
  subtitle?: string;
  role: "candidate" | "company" | "owner";
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const bg = "#F7F9FC";
  const navy = "#0B1F3B";
  const muted = "#5B6B7D";
  const accent = "#2F6BFF";
  const card = "#FFFFFF";
  const border = "rgba(11,31,59,0.10)";

  return (
    <main style={{ minHeight: "100vh", background: bg }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "rgba(247,249,252,0.9)",
          backdropFilter: "blur(8px)",
          borderBottom: `1px solid ${border}`,
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "14px 18px", display: "flex", gap: 18, alignItems: "center" }}>
          <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <Image src="/verijob-logo.png" alt="Verijob" width={130} height={40} priority />
          </Link>

          <div style={{ flex: 1 }}>
            <div style={{ color: navy, fontWeight: 900, fontSize: 18, lineHeight: 1.1 }}>{title}</div>
            {subtitle ? <div style={{ color: muted, fontSize: 13, marginTop: 2 }}>{subtitle}</div> : null}
          </div>

          <form action="/auth/logout" method="post">
            <button
              type="submit"
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: `1px solid ${border}`,
                background: card,
                color: navy,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Cerrar sesión
            </button>
          </form>
        </div>

        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 18px 12px 18px", display: "flex", gap: 10, flexWrap: "wrap" }}>
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  textDecoration: "none",
                  padding: "9px 12px",
                  borderRadius: 12,
                  border: `1px solid ${active ? accent : border}`,
                  background: active ? "#EEF3FF" : "transparent",
                  color: navy,
                  fontWeight: 900,
                  fontSize: 13,
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </header>

      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 18px 50px 18px" }}>
        {children}
      </section>

      <footer style={{ maxWidth: 1100, margin: "0 auto", padding: "22px 18px", color: muted, fontSize: 12 }}>
        Verijob · Panel {role} · {new Date().getFullYear()}
      </footer>
    </main>
  );
}