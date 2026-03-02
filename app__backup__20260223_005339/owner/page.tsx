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

export default async function OwnerHome() {
  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();
  if (!au.user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("id, role, full_name, onboarding_completed").eq("id", au.user.id).single();
  if (!profile || !profile.onboarding_completed) redirect("/onboarding");
  if (profile.role !== "owner") redirect("/dashboard");

  const { data: reqs } = await supabase
    .from("verification_requests")
    .select("id, status, created_at, company_user_id, candidate_user_id")
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: evid } = await supabase
    .from("evidence")
    .select("id, status, created_at, user_id")
    .order("created_at", { ascending: false })
    .limit(10);

  const pendingReq = (reqs ?? []).filter((r) => (r.status || "").toLowerCase().includes("pending")).length;
  const pendingEvid = (evid ?? []).filter((e) => (e.status || "").toLowerCase().includes("pending")).length;

  return (
    <DashboardShell
      role="owner"
      title="Panel Owner"
      subtitle={`Hola, ${profile.full_name || "owner"} · control operativo Verijob`}
      nav={[
        { href: "/owner", label: "Resumen" },
      ]}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 14 }}>
        <div style={{ gridColumn: "span 6" }}>
          <Card>
            <CardTitle>Solicitudes pendientes</CardTitle>
            <CardMeta>En cola: <b>{pendingReq}</b></CardMeta>
          </Card>
        </div>
        <div style={{ gridColumn: "span 6" }}>
          <Card>
            <CardTitle>Evidencias pendientes</CardTitle>
            <CardMeta>En revisión: <b>{pendingEvid}</b></CardMeta>
          </Card>
        </div>

        <div style={{ gridColumn: "span 12" }}>
          <Card>
            <CardTitle>Últimas solicitudes</CardTitle>
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {(reqs ?? []).map((r) => (
                <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 900, color: "#0B1F3B" }}>Solicitud #{r.id.slice(0, 8)}</div>
                    <div style={{ color: "#5B6B7D", fontSize: 13 }}>{new Date(r.created_at).toLocaleString("es-ES")}</div>
                  </div>
                  <Badge tone={toneForStatus(r.status) as any}>{(r.status || "N/A").toUpperCase()}</Badge>
                </div>
              ))}
              {(reqs ?? []).length === 0 ? <div style={{ color: "#5B6B7D" }}>Sin datos.</div> : null}
            </div>
          </Card>
        </div>

        <div style={{ gridColumn: "span 12" }}>
          <Card>
            <CardTitle>Últimas evidencias</CardTitle>
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {(evid ?? []).map((e) => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 900, color: "#0B1F3B" }}>Evidencia #{e.id.slice(0, 8)}</div>
                    <div style={{ color: "#5B6B7D", fontSize: 13 }}>{new Date(e.created_at).toLocaleString("es-ES")}</div>
                  </div>
                  <Badge tone={toneForStatus(e.status) as any}>{(e.status || "N/A").toUpperCase()}</Badge>
                </div>
              ))}
              {(evid ?? []).length === 0 ? <div style={{ color: "#5B6B7D" }}>Sin datos.</div> : null}
            </div>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}