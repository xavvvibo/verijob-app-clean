import Image from "next/image";
import Link from "next/link";

export default function Home() {
  const bg = "#F7F9FC";
  const navy = "#0B1F3B";
  const text = "#1E2A3A";
  const muted = "#5B6B7D";
  const accent = "#2F6BFF";
  const card = "#FFFFFF";
  const border = "rgba(11,31,59,0.10)";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: bg,
        color: text,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 1120, padding: "42px 20px" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 36,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Image src="/verijob-logo.png" alt="Verijob" width={150} height={44} priority />
          </div>

          <nav style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link
              href="/login?as=candidate"
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: `1px solid ${border}`,
                textDecoration: "none",
                color: navy,
                background: "transparent",
                fontWeight: 600,
              }}
            >
              Soy candidato
            </Link>
            <Link
              href="/login?as=company"
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: `1px solid ${accent}`,
                textDecoration: "none",
                color: "white",
                background: accent,
                fontWeight: 700,
              }}
            >
              Soy empresa
            </Link>
          </nav>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            gap: 28,
            alignItems: "center",
          }}
        >
          <div>
            <h1 style={{ fontSize: 44, lineHeight: 1.08, margin: 0, color: navy }}>
              De crear currículums a verificarlos.
            </h1>
            <p style={{ marginTop: 14, fontSize: 18, color: muted, maxWidth: 620 }}>
              Verifica experiencia profesional con consentimiento del candidato, evidencias y trazabilidad.
              Reduce riesgo en contratación y aumenta la credibilidad del perfil.
            </p>

            <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
              <Link
                href="/login?as=company"
                style={{
                  padding: "12px 16px",
                  borderRadius: 12,
                  textDecoration: "none",
                  color: "white",
                  background: accent,
                  fontWeight: 800,
                }}
              >
                Acceso empresa
              </Link>

              <Link
                href="/login?as=candidate"
                style={{
                  padding: "12px 16px",
                  borderRadius: 12,
                  textDecoration: "none",
                  color: navy,
                  background: "white",
                  border: `1px solid ${border}`,
                  fontWeight: 800,
                }}
              >
                Acceso candidato
              </Link>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 22 }}>
              {[
                { t: "Evidencias", d: "Documentos con caducidad, estado y trazabilidad." },
                { t: "Consentimiento", d: "El candidato controla qué se comparte y con quién." },
                { t: "Verificación", d: "Solicitudes, estados y caducidades centralizadas." },
              ].map((x) => (
                <div
                  key={x.t}
                  style={{
                    background: card,
                    border: `1px solid ${border}`,
                    borderRadius: 16,
                    padding: 14,
                  }}
                >
                  <div style={{ fontWeight: 900, color: navy }}>{x.t}</div>
                  <div style={{ fontSize: 13, color: muted, marginTop: 6 }}>{x.d}</div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              background: card,
              border: `1px solid ${border}`,
              borderRadius: 20,
              padding: 18,
            }}
          >
            <div style={{ fontWeight: 900, color: navy, marginBottom: 10 }}>Cómo funciona</div>
            <ol style={{ margin: 0, paddingLeft: 18, color: muted, lineHeight: 1.6 }}>
              <li>El candidato crea experiencias y sube evidencias.</li>
              <li>La empresa envía solicitud de verificación.</li>
              <li>El candidato da consentimiento y Verijob registra estados.</li>
            </ol>

            <div style={{ height: 12 }} />

            <div
              style={{
                padding: 12,
                borderRadius: 14,
                background: "#EEF3FF",
                color: navy,
                fontSize: 14,
              }}
            >
              Consejo: usa <strong>contraseña</strong> como acceso principal y deja el <strong>magic link</strong> como alternativa.
            </div>
          </div>
        </section>

        <footer style={{ marginTop: 34, display: "flex", justifyContent: "space-between", color: muted, fontSize: 13 }}>
          <span>© {new Date().getFullYear()} Verijob</span>
          <span style={{ color: navy, opacity: 0.75 }}>La verdad laboral, verificada.</span>
        </footer>
      </div>
    </main>
  );
}
