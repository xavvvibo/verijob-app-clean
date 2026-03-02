import Link from "next/link";
import { getCompanyVerificationInbox } from "../actions";

function badgeClass(status: string) {
  const base =
    "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium border";
  if (status === "verified") return `${base} border-green-600/40`;
  if (status === "rejected") return `${base} border-red-600/40`;
  return `${base} border-yellow-600/40`;
}

export default async function CompanyDashboardPage() {
  const rows = await getCompanyVerificationInbox();

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Company Dashboard</h1>
      <p style={{ opacity: 0.8, marginTop: 6 }}>
        Solicitudes de verificación recibidas
      </p>

      <div
        style={{
          marginTop: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 2fr 1fr 1fr 120px",
            gap: 12,
            padding: 12,
            fontWeight: 600,
            opacity: 0.9,
          }}
        >
          <div>Candidato</div>
          <div>Puesto / Fechas</div>
          <div>Estado</div>
          <div>Evidencias</div>
          <div></div>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: 16, opacity: 0.8 }}>
            No hay solicitudes todavía.
          </div>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 2fr 1fr 1fr 120px",
                gap: 12,
                padding: 12,
                borderTop: "1px solid rgba(255,255,255,0.08)",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>
                  {r.candidate_email || "—"}
                </div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>{r.id}</div>
              </div>

              <div>
                <div style={{ fontWeight: 600 }}>
                  {r.position || "—"}
                </div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {r.start_date ?? "—"} → {r.end_date ?? "Actual"}
                </div>
              </div>

              <div>
                <span className={badgeClass(r.status)}>
                  {r.status}
                </span>
              </div>

              <div style={{ fontWeight: 600 }}>
                {r.evidences_count}
              </div>

              <div style={{ textAlign: "right" }}>
                <Link
                  href={`/company/verification/${r.id}`}
                  style={{
                    display: "inline-block",
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.18)",
                    textDecoration: "none",
                  }}
                >
                  Revisar
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
