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

export default async function CandidateEvidencePage() {
  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();
  if (!au.user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("id, role, full_name, onboarding_completed").eq("id", au.user.id).single();
  if (!profile || !profile.onboarding_completed) redirect("/onboarding");

  const { data: rows } = await supabase
    .from("evidence")
    .select("id, file_name, file_size, file_url, status, expiry_date, created_at")
    .eq("user_id", au.user.id)
    .order("created_at", { ascending: false });

  return (
    <DashboardShell
      role="candidate"
      title="Evidencias"
      subtitle="Gestiona documentos y pruebas de tus experiencias."
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
            <div style={{ color: "#5B6B7D" }}>No hay evidencias aún.</div>
          ) : (
            (rows ?? []).map((r) => (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 900, color: "#0B1F3B" }}>{r.file_name || "Documento"}</div>
                  <div style={{ color: "#5B6B7D", fontSize: 13 }}>
                    Estado: <b>{r.status || "N/A"}</b>
                    {r.expiry_date ? ` · Caduca: ${new Date(r.expiry_date).toLocaleDateString("es-ES")}` : ""}
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