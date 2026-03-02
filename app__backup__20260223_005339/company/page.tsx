import { redirect } from "next/navigation";
import DashboardShell from "@/app/_components/DashboardShell";
import { Card, CardMeta, CardTitle, Badge } from "@/app/_components/ui";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function toneForStatus(s?: string) {
  const v = (s || "").toLowerCase();
  if (v.includes("approved") || v.includes("verified")) return "ok";
  if (v.includes("rejected")) return "err";
  if (v.includes("pending") || v.includes("review")) return "warn";
  return "neutral";
}

export default async function CompanyHome() {
  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();
  if (!au.user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("id, role, full_name, company_name, onboarding_completed").eq("id", au.user.id).single();
  if (!profile || !profile.onboarding_completed) redirect("/onboarding");
  if (profile.role !== "company" && profile.role !== "owner") redirect("/dashboard");

  const { data: reqs } = await supabase
    .from("verification_requests")
    .select("id, status, created_at, experience_id, candidate_user_id")
    .eq("company_user_id", au.user.id)
    .order("created_at", { ascending: false })
    .limit(8);

  const total = reqs?.length ?? 0;
  const pending = (reqs ?? []).filter((r) => (r.status || "").toLowerCase().includes("pending")).length;

  return (
    <DashboardShell
      role="company"
      title="Panel de Empresa"
      subtitle={profile.company_name ? profile.company_name : "Gestión de solicitudes de verificación"}
      nav={[
        { href: "/company", label: "Resumen" },
        { href: "/company/requests", label: "Solicitudes" },
      ]}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 14 }}>
        <div style={{ gridColumn: "span 6" }}>
          <Card>
            <CardTitle>Solicitudes</CardTitle>
            <CardMeta>Total recientes: <b>{total}</b></CardMeta>
          </Card>
        </div>
        <div style={{ gridColumn: "span 6" }}>
          <Card>
            <CardTitle>Pendientes</CardTitle>
            <CardMeta>En cola: <b>{pending}</b></CardMeta>
          </Card>
        </div>

        <div style={{ gridColumn: "span 12" }}>
          <Card>
            <CardTitle>Últimas solicitudes</CardTitle>
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {(reqs ?? []).length === 0 ? (
                <div style={{ color: "#5B6B7D" }}>Aún no hay solicitudes. Ve a “Solicitudes”.</div>
              ) : (
                (reqs ?? []).map((r) => (
                  <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 900, color: "#0B1F3B" }}>Solicitud #{r.id.slice(0, 8)}</div>
                      <div style={{ color: "#5B6B7D", fontSize: 13 }}>
                        Estado: <b>{r.status || "N/A"}</b> · {new Date(r.created_at).toLocaleString("es-ES")}
                      </div>
                    </div>
                    <Badge tone={toneForStatus(r.status) as any}>{(r.status || "N/A").toUpperCase()}</Badge>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}