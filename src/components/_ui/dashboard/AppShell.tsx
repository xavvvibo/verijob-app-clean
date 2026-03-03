import React from "react";
import { ui } from "../tokens";

type NavItem = { label: string; active?: boolean };
type Props = {
  title?: string;
  subtitle?: string;
  nav?: NavItem[];
  children: React.ReactNode;
};

function AppShell({
  title = "Dashboard",
  subtitle = "Vista previa UI",
  nav = [
    { label: "Dashboard", active: true },
    { label: "Requests" },
    { label: "Verificaciones" },
    { label: "Evidencias" },
    { label: "Reuse" },
    { label: "Settings" },
  ],
  children,
}: Props) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: ui.colors.bg,
        color: ui.colors.text,
        fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 950, letterSpacing: "-0.02em" }}>{title}</div>
            <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: ui.colors.muted }}>{subtitle}</div>
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 900,
              padding: "6px 10px",
              borderRadius: 999,
              border: `1px solid ${ui.colors.border}`,
              background: "rgba(255,255,255,0.75)",
            }}
          >
            {ui.brand.name}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 14, marginTop: 16 }}>
          <aside
            style={{
              borderRadius: ui.radius.lg,
              background: ui.colors.surface,
              border: `1px solid ${ui.colors.border}`,
              padding: 12,
            }}
          >
            <div style={{ fontWeight: 950, marginBottom: 8 }}>{ui.brand.name}</div>
            <div style={{ display: "grid", gap: 6 }}>
              {nav.map((it) => (
                <div
                  key={it.label}
                  style={{
                    padding: "10px 10px",
                    borderRadius: 12,
                    fontWeight: 900,
                    background: it.active ? "rgba(47,93,170,0.10)" : "transparent",
                    border: it.active ? "1px solid rgba(47,93,170,0.15)" : "1px solid transparent",
                    color: it.active ? ui.colors.ink : ui.colors.muted,
                  }}
                >
                  {it.label}
                </div>
              ))}
            </div>
          </aside>

          <main>{children}</main>
        </div>
      </div>
    </div>
  );
}

export { AppShell };
export default AppShell;
