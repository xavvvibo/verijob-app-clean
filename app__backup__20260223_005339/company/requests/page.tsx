import { redirect } from "next/navigation";
import DashboardShell from "@/app/_components/DashboardShell";
import { Card, CardTitle, Badge } from "@/app/_components/ui";
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

export default async function CompanyRequests() {
  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();
  if (!au.user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("id, role, onboarding_completed").eq("id", au.user.id).single();
  if (!profile || !profile.onboarding_completed) redirect("/onboarding");
  if (profile.role !== "company" && profile.role !== "owner") redirect("/dashboard");

  const { data: rows } = await supabase
    .from("verification_requests")
    .select("id, status, created_at, expires_at, updated_at, candidate_user_id, experience_id")
    .eq("company_user_id", au.user.id)
    .order("created_at", { ascending: false });

  return (
    <DashboardShell
      role="company"
      title="Solicitudes"
      subtitle="Revisa la cola de verificaciones."
      nav={[
        { href: "/company", label: "Resumen" },
        { href: "/company/requests", label: "Solicitudes" },
      ]}
    >
      <Card>
        <CardTitle>Listado</CardTitle>
        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          {(rows ?? []).length === 0 ? (
            <div style={{ color: "#5B6B7D" }}>No hay solicitudes.</div>
          ) : (
            (rows ?? []).map((r) => (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 900, color: "#0B1F3B" }}>Solicitud #{r.id.slice(0, 8)}</div>
                  <div style={{ color: "#5B6B7D", fontSize: 13 }}>
                    {new Date(r.created_at).toLocaleString("es-ES")}
                    {r.expires_at ? ` · Expira: ${new Date(r.expires_at).toLocaleString("es-ES")}` : ""}
                  </div>
                </div>
                <Badge tone={toneForStatus(r.status) as any}>{(r.status || "N/A").toUpperCase()}</Badge>
              </div>
            ))
          )}
        </div>
      </Card>
    </DashboardShell>
  );
}