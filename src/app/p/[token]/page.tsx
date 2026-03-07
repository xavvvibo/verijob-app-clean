export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

export default async function PublicCandidateProfilePage({ params }: Ctx) {
  const { token } = await params;
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://app.verijob.es";

  const res = await fetch(`${base}/api/public/candidate/${token}`, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", padding: 24 }}>
        <div style={{ maxWidth: 720, textAlign: "center" }}>
          <h1 style={{ fontSize: 32, marginBottom: 12 }}>Perfil no disponible</h1>
          <p style={{ color: "#555", marginBottom: 12 }}>
            Este enlace no existe, ha caducado o no está disponible ahora mismo.
          </p>
          <pre style={{ background: "#f5f5f5", padding: 16, borderRadius: 12, overflow: "auto" }}>
{JSON.stringify({ status: res.status, error: body?.error || "unknown" }, null, 2)}
          </pre>
        </div>
      </main>
    );
  }

  const teaser = body?.teaser || {};
  const trust = Number(teaser?.trust_score ?? 0);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 860, width: "100%" }}>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, background: "#fff", padding: 24 }}>
          <h1 style={{ fontSize: 28, marginBottom: 6 }}>{teaser?.full_name || "Candidato verificado"}</h1>
          <p style={{ color: "#64748b", marginBottom: 20 }}>
            {teaser?.title || "Perfil profesional verificado"} · Verijob
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12 }}>
            <Stat label="Trust Score" value={trust} />
            <Stat label="Experiencias" value={Number(teaser?.experiences_total || 0)} />
            <Stat label="Verificadas" value={Number(teaser?.verified_experiences || 0)} />
            <Stat label="Evidencias" value={Number(teaser?.evidences_total || 0)} />
          </div>

          {teaser?.summary ? (
            <p style={{ marginTop: 18, color: "#334155", lineHeight: 1.5 }}>{String(teaser.summary)}</p>
          ) : null}

          <div style={{ marginTop: 20, fontSize: 12, color: "#64748b" }}>
            Route: {body?.route_version || "public-candidate-token-v1"} · token: {token}
          </div>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#f8fafc" }}>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 600, color: "#0f172a" }}>{value}</div>
    </div>
  );
}
