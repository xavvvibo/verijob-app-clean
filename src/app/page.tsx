import Link from "next/link";

const APP = "https://app.verijob.es";

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: "inline-block", padding: "6px 10px", border: "1px solid #e5e7eb", borderRadius: 999, fontSize: 12, color: "#374151", background: "#fff" }}>
      {children}
    </span>
  );
}

export default function Home() {
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Verijob",
    url: "https://verijob.es",
    email: "contacto@verijob.es",
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />

      {/* HERO */}
      <section style={{ padding: "64px 16px", background: "#ffffff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 14 }}>
            <Pill>Infraestructura de verificación profesional</Pill>
            <Pill>El estándar verificable para contratación</Pill>
          </div>

          <h1 style={{ fontSize: 44, letterSpacing: -0.8, margin: 0, color: "#111827" }}>
            Confianza verificable en cada contratación.
          </h1>

          <p style={{ maxWidth: 760, margin: "16px auto 0", fontSize: 18, lineHeight: 1.55, color: "#374151" }}>
            Verijob convierte la experiencia profesional y la formación en credenciales verificadas, trazables y reutilizables.
          </p>

          <div style={{ marginTop: 26, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href={`${APP}/signup?role=candidate`} style={{ padding: "12px 16px", borderRadius: 10, background: "#111827", color: "#fff", textDecoration: "none", fontWeight: 600 }}>
              Soy candidato
            </Link>
            <Link href={`${APP}/signup?role=company`} style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", color: "#111827", textDecoration: "none", fontWeight: 600 }}>
              Soy empresa
            </Link>
            <Link href="/como-funciona" style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", color: "#111827", textDecoration: "none", fontWeight: 600 }}>
              Cómo funciona
            </Link>
          </div>

          <p style={{ marginTop: 18, color: "#6b7280", fontSize: 14 }}>
            No envíes solo un CV. Envía confianza verificable.
          </p>
        </div>
      </section>

      {/* PROBLEMA */}
      <section style={{ padding: "44px 16px", background: "#ffffff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 18 }}>
            <h2 style={{ margin: 0, fontSize: 18, color: "#111827" }}>Para empresas</h2>
            <p style={{ marginTop: 10, color: "#374151", lineHeight: 1.6 }}>
              Referencias informales, verificación manual y riesgo innecesario. Reduce incertidumbre antes de contratar.
            </p>
          </div>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 18 }}>
            <h2 style={{ margin: 0, fontSize: 18, color: "#111827" }}>Para candidatos</h2>
            <p style={{ marginTop: 10, color: "#374151", lineHeight: 1.6 }}>
              Convierte tu trayectoria en una credencial verificable y compártela según cada oportunidad.
            </p>
          </div>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 18 }}>
            <h2 style={{ margin: 0, fontSize: 18, color: "#111827" }}>El problema de fondo</h2>
            <p style={{ marginTop: 10, color: "#374151", lineHeight: 1.6 }}>
              El sistema actual es informal, opaco y poco escalable. Verijob estandariza la confianza.
            </p>
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA (bloque gráfico simple, dos columnas, fondo gris claro) */}
      <section style={{ padding: "56px 16px", background: "#f9fafb" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ margin: 0, fontSize: 28, color: "#111827", textAlign: "center" }}>Cómo funciona</h2>
          <p style={{ marginTop: 10, textAlign: "center", color: "#6b7280" }}>Un proceso simple, estructurado y verificable.</p>

          <div style={{ marginTop: 26, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 18 }}>
              <div style={{ fontWeight: 700, marginBottom: 10, color: "#111827" }}>Candidato</div>
              <ol style={{ margin: 0, paddingLeft: 18, color: "#374151", lineHeight: 1.75 }}>
                <li>Solicita verificación</li>
                <li>La empresa confirma tu experiencia</li>
                <li>Se emite tu credencial verificable</li>
                <li>Tú decides qué compartir en cada oportunidad</li>
              </ol>
              <div style={{ marginTop: 12, color: "#6b7280", fontSize: 14 }}>Tu trayectoria, con respaldo profesional.</div>
            </div>

            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 18 }}>
              <div style={{ fontWeight: 700, marginBottom: 10, color: "#111827" }}>Empresa</div>
              <ol style={{ margin: 0, paddingLeft: 18, color: "#374151", lineHeight: 1.75 }}>
                <li>Recibe solicitud</li>
                <li>Verifica datos estructurados</li>
                <li>Emite credencial auditada</li>
                <li>Consulta información fiable antes de contratar</li>
              </ol>
              <div style={{ marginTop: 12, color: "#6b7280", fontSize: 14 }}>Menos riesgo. Más confianza.</div>
            </div>
          </div>

          <div style={{ marginTop: 22, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/para-candidatos" style={{ textDecoration: "none", color: "#111827", padding: "10px 14px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", fontWeight: 600 }}>
              Ver flujo candidato
            </Link>
            <Link href="/para-empresas" style={{ textDecoration: "none", color: "#111827", padding: "10px 14px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", fontWeight: 600 }}>
              Ver flujo empresa
            </Link>
          </div>
        </div>
      </section>

      {/* DIFERENCIADOR */}
      <section style={{ padding: "56px 16px", background: "#ffffff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ margin: 0, fontSize: 28, color: "#111827", textAlign: "center" }}>No es un CV bonito. Es confianza verificable.</h2>
          <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 18 }}>
              <div style={{ fontWeight: 700, color: "#111827" }}>Infraestructura</div>
              <p style={{ marginTop: 10, color: "#374151", lineHeight: 1.6 }}>
                Un sistema estructurado para emitir, consultar y reutilizar credenciales verificadas.
              </p>
            </div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 18 }}>
              <div style={{ fontWeight: 700, color: "#111827" }}>Control del candidato</div>
              <p style={{ marginTop: 10, color: "#374151", lineHeight: 1.6 }}>
                El candidato decide qué verificaciones incluir en cada enlace compartido.
              </p>
            </div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 18 }}>
              <div style={{ fontWeight: 700, color: "#111827" }}>Trazabilidad</div>
              <p style={{ marginTop: 10, color: "#374151", lineHeight: 1.6 }}>
                Registro y consistencia para reducir riesgos antes de contratar.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ padding: "64px 16px", background: "#111827" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ margin: 0, fontSize: 30, color: "#fff" }}>Empieza hoy.</h2>
          <p style={{ marginTop: 10, color: "#d1d5db" }}>
            Verificaciones laborales y académicas con trazabilidad real y respaldo profesional.
          </p>
          <div style={{ marginTop: 18, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href={`${APP}/signup?role=candidate`} style={{ padding: "12px 16px", borderRadius: 10, background: "#fff", color: "#111827", textDecoration: "none", fontWeight: 700 }}>
              Crear cuenta candidato
            </Link>
            <Link href={`${APP}/signup?role=company`} style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid #374151", background: "transparent", color: "#fff", textDecoration: "none", fontWeight: 700 }}>
              Crear cuenta empresa
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
