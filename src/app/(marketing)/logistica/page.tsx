import type { Metadata } from "next";
import Link from "next/link";
const APP = "https://app.verijob.es";

export const metadata: Metadata = {
  title: "Logística",
  description: "Verificaciones profesionales para contratación en logística.",
  alternates: { canonical: "/logistica" },
};

export default function Logistica() {
  return (
    <main style={{ padding: "44px 16px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontSize: 34, margin: 0, color: "#111827" }}>Verijob en logística</h1>
        <p style={{ marginTop: 12, color: "#374151", lineHeight: 1.7 }}>
          Asegura fiabilidad del personal, reduce riesgo operativo y estandariza la confianza con credenciales verificadas.
        </p>
        <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            href={`https://app.verijob.es/signup?role=company`}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "#111827",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Crear cuenta empresa
          </Link>
          <Link
            href="/como-funciona"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              color: "#111827",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Ver cómo funciona
          </Link>
        </div>
      </div>
    </main>
  );
}
