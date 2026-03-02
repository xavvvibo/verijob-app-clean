import { redirect } from "next/navigation";
import DashboardShell from "@/app/_components/DashboardShell";
import { Card, CardTitle, Badge } from "@/app/_components/ui";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CandidateExperiencePage() {
  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();
  if (!au.user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("id, role, full_name, onboarding_completed").eq("id", au.user.id).single();
  if (!profile || !profile.onboarding_completed) redirect("/onboarding");

  const { data: rows } = await supabase
    .from("experiences")
    .select("id, title, company_name, start_date, end_date, is_current, description, created_at")
    .eq("user_id", au.user.id)
    .order("created_at", { ascending: false });

  return (
    <DashboardShell
      role="candidate"
      title="Experiencias"
      subtitle="Añade y revisa tus experiencias laborales."
      nav={[
        { href: "/candidate", label: "Resumen" },
        { href: "/candidate/experience", label: "Experiencias" },
        { href: "/candidate/evidence", label: "Evidencias" },
      ]}
    >
      <Card>
        <CardTitle>Listado</CardTitle>
        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          {(rows ?? []).length === 0 ? (
            <div style={{ color: "#5B6B7D" }}>No hay experiencias aún.</div>
          ) : (
            (rows ?? []).map((r) => (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 900, color: "#0B1F3B" }}>{r.title || "Experiencia"}</div>
                  <div style={{ color: "#5B6B7D", fontSize: 13 }}>
                    {r.company_name || "Empresa"} · {r.is_current ? "Actual" : "Finalizada"}
                  </div>
                </div>
                <Badge tone="neutral">{new Date(r.created_at).toLocaleDateString("es-ES")}</Badge>
              </div>
            ))
          )}
        </div>
      </Card>
    </DashboardShell>
  );
}