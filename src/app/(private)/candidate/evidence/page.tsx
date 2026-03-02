import { redirect } from "next/navigation";
import DashboardShell from  "@/app/_components/DashboardShell";
import { Card, CardTitle, Badge } from  "@/app/_components/ui";
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, onboarding_completed")
    .eq("id", au.user.id)
    .single();
  if (!profile || !profile.onboarding_completed) redirect("/onboarding");

  const { data: reqs } = await supabase
    .from("verification_requests")
    .select(
      "id, status, submitted_at, resolved_at, created_at, employment_records (id, company_name_freeform, position, start_date, end_date, company_id), revoked_at, revoked_reason"
    )
    .eq("requested_by", au.user.id)
    .order("created_at", { ascending: false });

  const items = (reqs || []).map((r: any) => {
    const er = Array.isArray(r.employment_records) ? r.employment_records[0] : r.employment_records;
    const status = r.status || "unknown";
    
  const statusVisible = ((r as any).revoked_at ? "revoked" : status);
const tone = toneForStatus(statusVisible);
    return { ...r, employment: er, tone, statusVisible };
  });

  return (
    <DashboardShell title="Evidencias y verificaciones">
      <div className="space-y-4">
        <Card>
          <CardTitle>Mis verificaciones</CardTitle>
          <div className="mt-3 space-y-2">
            {items.length === 0 ? (
              <div className="text-sm text-gray-600">
                Aún no has solicitado verificaciones.
              </div>
            ) : (
              items.map((it: any) => (
                <div
                  key={it.id}
                  className="flex flex-col gap-1 rounded-lg border p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{it.statusVisible ?? it.status}</Badge>
                    <div className="text-sm font-medium">
                      {it.employment?.company_name_freeform || "Empresa"}
                    </div>
                    <div className="text-sm text-gray-600">
                      {it.employment?.position || ""}
                    </div>
                  </div>
                  <div className="text-xs text-gray-600">
                    Solicitud: {it.submitted_at || it.created_at || ""}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
