"use client";

export default function Topbar({ role, name }: { role: string; name: string }) {
  return (
    <header
      style={{
        background: "rgba(247,249,252,0.85)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid var(--vj-border)",
        padding: "14px 24px",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 800, color: "var(--vj-ink)" }}>Dashboard</div>
          <div className="vj-muted" style={{ fontSize: 13 }}>
            {name} · <span style={{ color: "var(--vj-brand)", fontWeight: 700 }}>{role}</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="vj-badge">
            <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--vj-accent)" }} />
            Verificación
          </span>
        </div>
      </div>
    </header>
  );
}
