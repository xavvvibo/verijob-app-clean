import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function CompanyVerificationDetail(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_company_id, onboarding_completed")
    .eq("id", user.id)
    .single();

  if (!profile?.onboarding_completed) redirect("/onboarding");
  if (!profile?.active_company_id) redirect("/dashboard");

  const { data } = await supabase
    .from("verification_summary")
    .select("*")
    .eq("verification_id", id)
    .eq("company_id", profile.active_company_id)
    .single();

  if (!data) redirect("/company/requests");

  const canReuse =
    data.status_effective === "verified" &&
    data.is_revoked === false;

  return (
    <div style={{ padding: 32, maxWidth: 900 }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>
        Verificación {data.verification_id.slice(0, 8)}
      </h1>

      <div style={{
        display: "inline-block",
        padding: "6px 12px",
        borderRadius: 8,
        fontWeight: 600,
        marginBottom: 20,
        background:
          data.status_effective === "verified" ? "#DCFCE7" :
          data.status_effective === "reviewing" ? "#FEF9C3" :
          data.status_effective === "revoked" ? "#FEE2E2" :
          "#E5E7EB"
      }}>
        Estado: {data.status_effective}
      </div>

      {data.is_revoked && (
        <div style={{
          marginBottom: 20,
          padding: 16,
          borderRadius: 8,
          background: "#FEE2E2",
          border: "1px solid #FCA5A5"
        }}>
          <strong>Verificación revocada</strong>
          <div style={{ marginTop: 8 }}>
            Motivo: {data.revoked_reason || "No especificado"}
          </div>
          <div>
            Fecha: {data.revoked_at}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <h3>Datos principales</h3>
        <p><strong>Puesto:</strong> {data.position || "-"}</p>
        <p><strong>Inicio:</strong> {data.start_date || "-"}</p>
        <p><strong>Fin:</strong> {data.end_date || "-"}</p>
        <p><strong>Nivel:</strong> {data.verification_level}</p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h3>Evidencias</h3>
        <p>{data.evidence_count} documentos asociados</p>
      </div>

      {canReuse && (
        <form action="/api/company/reuse" method="POST">
          <input type="hidden" name="verification_id" value={data.verification_id} />
          <button
            style={{
              padding: "10px 18px",
              borderRadius: 8,
              background: "#111827",
              color: "white",
              border: "none",
              cursor: "pointer"
            }}
          >
            Reutilizar verificación
          </button>
        </form>
      )}
    </div>
  );
}
