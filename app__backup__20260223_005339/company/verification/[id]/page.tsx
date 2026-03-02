import Link from "next/link";
import { getCompanyVerificationDetail, getVerificationActions } from "../../actions";
import DecisionPanel from "./DecisionPanel";

export default async function CompanyVerificationDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const [vr, actions] = await Promise.all([
    getCompanyVerificationDetail(id),
    getVerificationActions(id),
  ]);

  if (!vr) {
    return (
      <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          Verificación no encontrada
        </h1>
        <p style={{ opacity: 0.8, marginTop: 10 }}>
          No existe una solicitud con ese ID o tu usuario no tiene acceso (RLS).
        </p>
        <p style={{ opacity: 0.8 }}>
          ID solicitado: <span style={{ fontWeight: 700 }}>{id}</span>
        </p>
        <Link
          href="/company/dashboard"
          style={{
            display: "inline-block",
            marginTop: 12,
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.18)",
            textDecoration: "none",
          }}
        >
          Volver al dashboard
        </Link>
      </main>
    );
  }

  const er: any = (vr as any)?.employment_record;
  const candidate: any = er?.candidate;

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            Verificación
          </h1>
          <p style={{ opacity: 0.8, marginTop: 6 }}>
            Revisa evidencias y valida la experiencia laboral
          </p>
        </div>

        <div style={{ alignSelf: "flex-start" }}>
          <Link
            href="/company/dashboard"
            style={{
              display: "inline-block",
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.18)",
              textDecoration: "none",
            }}
          >
            Volver
          </Link>
        </div>
      </div>

      <section
        style={{
          marginTop: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          padding: 16,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Candidato</div>
            <div style={{ fontWeight: 700 }}>
              {candidate?.full_name ?? "—"}
            </div>
            <div style={{ opacity: 0.85 }}>{candidate?.email ?? "—"}</div>
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Puesto</div>
            <div style={{ fontWeight: 700 }}>{er?.position ?? "—"}</div>
            <div style={{ opacity: 0.85 }}>
              {er?.start_date ?? "—"} → {er?.end_date ?? "Actual"}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
          Estado actual:{" "}
          <span style={{ fontWeight: 700, opacity: 1 }}>
            {(vr as any)?.status ?? "—"}
          </span>
        </div>
      </section>

      <section
        style={{
          marginTop: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          padding: 16,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 0 }}>
          Evidencias
        </h2>

        {Array.isArray((vr as any)?.evidences) && (vr as any).evidences.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {(vr as any).evidences.map((ev: any) => (
              <li key={ev.id} style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 600 }}>
                  {ev.evidence_type ?? "evidence"} · {ev.id}
                </div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  path: {ev.storage_path}
                </div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {ev.created_at}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ opacity: 0.8 }}>Aún no hay evidencias adjuntas.</div>
        )}
      </section>

      <section
        style={{
          marginTop: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          padding: 16,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 0 }}>
          Timeline (auditoría)
        </h2>

        {Array.isArray(actions) && actions.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {actions.map((a: any) => (
              <li key={a.id} style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 700 }}>{a.action}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  actor: {a.actor_id ?? "—"} · {a.created_at}
                </div>
                {a.metadata ? (
                  <pre style={{ marginTop: 6, whiteSpace: "pre-wrap", opacity: 0.9 }}>
{JSON.stringify(a.metadata, null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ opacity: 0.8 }}>No hay acciones registradas todavía.</div>
        )}
      </section>

      <section style={{ marginTop: 16 }}>
        <DecisionPanel verificationRequestId={(vr as any).id} currentStatus={(vr as any).status} />
      </section>
    </main>
  );
}
