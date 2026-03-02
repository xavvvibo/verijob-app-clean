"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Role = "candidate" | "company" | "owner" | "admin" | string;

function Item({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "10px 12px",
        borderRadius: 12,
        marginBottom: 6,
        background: active ? "rgba(245,185,66,0.16)" : "transparent",
        border: active ? "1px solid rgba(245,185,66,0.35)" : "1px solid transparent",
        color: active ? "var(--vj-ink)" : "rgba(255,255,255,0.88)",
      }}
    >
      {label}
    </Link>
  );
}

export default function Sidebar({ role }: { role: Role }) {
  const isCandidate = role === "candidate";
  const isCompany = role === "company";
  const isOwner = role === "owner";
  const isAdmin = role === "admin";

  return (
    <aside
      style={{
        background: "linear-gradient(180deg, var(--vj-ink), #14233b)",
        color: "white",
        padding: 18,
        position: "sticky",
        top: 0,
        height: "100vh",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: "rgba(47,93,170,0.25)",
            border: "1px solid rgba(255,255,255,0.12)",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
          }}
        >
          ✓
        </div>
        <div>
          <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>Verijob</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Panel</div>
        </div>
      </div>

      <div style={{ fontSize: 12, opacity: 0.7, margin: "12px 0 8px" }}>GENERAL</div>
      <Item href="/dashboard" label="Resumen" />

      {isCandidate && (
        <>
          <div style={{ fontSize: 12, opacity: 0.7, margin: "14px 0 8px" }}>CANDIDATO</div>
          <Item href="/dashboard/experiencias" label="Experiencias" />
          <Item href="/dashboard/evidencias" label="Evidencias" />
          <Item href="/dashboard/verificaciones" label="Solicitudes" />
        </>
      )}

      {(isCompany || isOwner) && (
        <>
          <div style={{ fontSize: 12, opacity: 0.7, margin: "14px 0 8px" }}>EMPRESA</div>
          <Item href="/dashboard/solicitudes" label="Solicitudes de verificación" />
          <Item href="/dashboard/candidatos" label="Candidatos" />
          <Item href="/dashboard/configuracion-empresa" label="Configuración" />
        </>
      )}

      {(isOwner || isAdmin) && (
        <>
          <div style={{ fontSize: 12, opacity: 0.7, margin: "14px 0 8px" }}>PLATAFORMA</div>
          <Item href="/dashboard/admin" label="Admin" />
          <Item href="/dashboard/metricas" label="Métricas" />
          <Item href="/dashboard/seguridad" label="Seguridad & Auditoría" />
        </>
      )}

      <div style={{ position: "absolute", left: 18, right: 18, bottom: 18 }}>
        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
          Rol: <span style={{ color: "var(--vj-accent)", fontWeight: 700 }}>{String(role)}</span>
        </div>
        <Link className="vj-btn" href="/login" style={{ width: "100%", color: "white", borderColor: "rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)" }}>
          Cambiar sesión
        </Link>
      </div>
    </aside>
  );
}
