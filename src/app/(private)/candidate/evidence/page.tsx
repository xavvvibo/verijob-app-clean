import { redirect } from "next/navigation";
import DashboardShell from  "@/app/_components/DashboardShell";
import { Card, CardTitle, Badge } from  "@/app/_components/ui";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function toneForStatus(s?: string) {
  const v = (s || "").toLowerCase();
  if (v.includes("verified") || v.includes("approved")) return "accepted";
  if (v.includes("rejected")) return "rejected";
  if (v.includes("clarif") || v.includes("modified")) return "needs_clarification";
  return "processing";
}

function labelForStatus(s?: string) {
  const t = toneForStatus(s);
  if (t === "accepted") return "accepted";
  if (t === "rejected") return "rejected";
  if (t === "needs_clarification") return "needs clarification";
  return "processing";
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

  const { data: evidences } = await supabase
    .from("evidences")
    .select("id, verification_request_id, storage_path, created_at, verification_requests(status, employment_records(position, company_name_freeform))")
    .eq("uploaded_by", au.user.id)
    .order("created_at", { ascending: false });

  const items = (evidences || []).map((r: any) => {
    const vr = Array.isArray(r.verification_requests) ? r.verification_requests[0] : r.verification_requests;
    const er = Array.isArray(vr?.employment_records) ? vr.employment_records[0] : vr?.employment_records;
    const status = vr?.status || "processing";
    const docName = String(r.storage_path || "documento").split("/").pop() || "documento";
    return {
      id: r.id,
      document_name: docName,
      experience: [er?.position, er?.company_name_freeform].filter(Boolean).join(" · ") || "Experiencia no vinculada",
      status,
      label: labelForStatus(status),
      created_at: r.created_at,
    };
  });

  return (
    <DashboardShell title="Evidencias">
      <div className="space-y-4">
        <Card>
          <CardTitle>Documentos de verificación</CardTitle>
          <div className="mt-2 text-sm text-gray-600">
            Aquí solo se muestran documentos de verificación subidos para experiencias. El CV no aparece en este listado.
          </div>
          <div className="mt-3 space-y-2">
            {items.length === 0 ? (
              <div className="text-sm text-gray-600">
                Aún no has subido documentos de verificación.
              </div>
            ) : (
              items.map((it: any) => (
                <div
                  key={it.id}
                  className="flex flex-col gap-1 rounded-lg border p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{it.label}</Badge>
                    <div className="text-sm font-medium">{it.document_name}</div>
                  </div>
                  <div className="text-xs text-gray-600">Experiencia vinculada: {it.experience}</div>
                  <div className="text-xs text-gray-600">Subido: {it.created_at || "—"}</div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
