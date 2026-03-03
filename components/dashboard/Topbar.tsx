"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function Topbar({ role, name }: { role: string; name: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

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

          <div ref={wrapRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={open}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                border: "1px solid var(--vj-border)",
                background: "white",
                padding: "8px 10px",
                borderRadius: 10,
                cursor: "pointer",
                color: "var(--vj-ink)",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  background: "rgba(124,58,237,0.12)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  color: "var(--vj-brand)",
                }}
              >
                {(name?.trim()?.[0] || "U").toUpperCase()}
              </span>
              <span style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {name}
              </span>
              <span aria-hidden style={{ opacity: 0.7 }}>▾</span>
            </button>

            {open ? (
              <div
                role="menu"
                style={{
                  position: "absolute",
                  right: 0,
                  marginTop: 8,
                  width: 220,
                  background: "white",
                  border: "1px solid var(--vj-border)",
                  borderRadius: 12,
                  boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--vj-border)" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "var(--vj-ink)" }}>{name}</div>
                  <div style={{ fontSize: 12, color: "var(--vj-muted)" }}>{role}</div>
                </div>

                <div style={{ padding: 6 }}>
                  <Link
                    href="/logout"
                    role="menuitem"
                    style={{
                      display: "block",
                      padding: "10px 10px",
                      borderRadius: 10,
                      textDecoration: "none",
                      color: "#b91c1c",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                    onClick={() => setOpen(false)}
                  >
                    Cerrar sesión
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
