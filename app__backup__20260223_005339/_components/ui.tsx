export function Card({ children }: { children: React.ReactNode }) {
  const border = "rgba(11,31,59,0.10)";
  return (
    <div style={{ background: "#fff", border: `1px solid ${border}`, borderRadius: 16, padding: 16 }}>
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontWeight: 900, fontSize: 16, color: "#0B1F3B" }}>{children}</div>;
}

export function CardMeta({ children }: { children: React.ReactNode }) {
  return <div style={{ marginTop: 6, color: "#5B6B7D", fontSize: 13 }}>{children}</div>;
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "ok" | "warn" | "err" }) {
  const map = {
    neutral: { bg: "rgba(11,31,59,0.06)", fg: "#0B1F3B" },
    ok: { bg: "rgba(10,122,47,0.10)", fg: "#0A7A2F" },
    warn: { bg: "rgba(198,128,0,0.12)", fg: "#8A5A00" },
    err: { bg: "rgba(176,0,32,0.10)", fg: "#B00020" },
  }[tone];

  return (
    <span style={{ display: "inline-block", padding: "6px 10px", borderRadius: 999, background: map.bg, color: map.fg, fontWeight: 900, fontSize: 12 }}>
      {children}
    </span>
  );
}