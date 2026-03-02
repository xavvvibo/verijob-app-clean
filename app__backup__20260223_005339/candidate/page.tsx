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

export default async function CandidateHome() {
  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();
  if (!au.user) redirect("/login");

  // profile
  const { data: profile } = await supabase.from("profiles").select("id, role, full_name, onboarding_completed").eq("id", au.user.id).single();
  if (!profile) redirect("/onboarding");
  if (!profile.onboarding_completed) redirect("/onboarding");
  if (profile.role !== "candidate" && profile.role !== "owner") redirect("/dashboard"); // owner puede ver todo

  const { data: exps } = await supabase
    .from("experiences")
    .select("id, title, company_name, start_date, end_date, is_current, created_at")
    .eq("user_id", au.user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: evid } = await supabase
    .from("evidence")
    .select("id, status, created_at")
    .eq("user_id", au.user.id);

  const totalExp = exps?.length ?? 0;
  const totalEvid = evid?.length ?? 0;
  const pending = (evid ?? []).filter((e) => (e.status || "").toLowerCase().includes("pending")).length;

  return (
    <DashboardShell
      role="candidate"
      title="Panel de Candidato"
      subtitle={`Hola, ${profile.full_name || "candidato"} · Tu perfil verificable en un clic`}
      nav={[
        { href: "/candidate", label: "Resumen" },
        { href: "/candidate/experience", label: "Experiencias" },
        { href: "/candidate/evidence", label: "Evidencias" },
      ]}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 14 }}>
        <div style={{ gridColumn: "span 4" }}>
          <Card>
            <CardTitle>Experiencias</CardTitle>
            <CardMeta>Total: <b>{totalExp}</b></CardMeta>
          </Card>
        </div>
        <div style={{ gridColumn: "span 4" }}>
          <Card>
            <CardTitle>Evidencias</CardTitle>
            <CardMeta>Total: <b>{totalEvid}</b></CardMeta>
          </Card>
        </div>
        <div style={{ gridColumn: "span 4" }}>
          <Card>
            <CardTitle>Pendientes</CardTitle>
            <CardMeta>
              En revisión: <b>{pending}</b>
            </CardMeta>
          </Card>
        </div>

        <div style={{ gridColumn: "span 12" }}>
          <Card>
            <CardTitle>Últimas experiencias</CardTitle>
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {(exps ?? []).length === 0 ? (
                <div style={{ color: "#5B6B7D" }}>Aún no has añadido experiencias. Ve a “Experiencias”.</div>
              ) : (
                (exps ?? []).map((e) => (
                  <div key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 900, color: "#0B1F3B" }}>{e.title || "Experiencia"}</div>
                      <div style={{ color: "#5B6B7D", fontSize: 13 }}>
                        {e.company_name || "Empresa"} · {e.is_current ? "Actual" : "Finalizada"}
                      </div>
                    </div>
                    <Badge tone="neutral">{new Date(e.created_at).toLocaleDateString("es-ES")}</Badge>
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