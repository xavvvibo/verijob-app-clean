import { redirect } from "next/navigation";
import DashboardShell from "@/app/_components/DashboardShell";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import EvidenceListClient from "./EvidenceListClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type EvidenceItem = {
  id: string;
  document_name: string;
  experience: string;
  status: string;
  created_at: string | null;
};

type ExperienceOption = {
  id: string;
  label: string;
};

function statusEs(status: string) {
  const v = String(status || "").toLowerCase();
  if (v.includes("verified") || v.includes("approved")) return "Aceptada";
  if (v.includes("rejected")) return "Rechazada";
  if (v.includes("clarif") || v.includes("modified")) return "Pendiente de aclaración";
  return "Procesando";
}

function documentaryStatusEs(row: any) {
  const linkState = String(row?.verification_requests?.request_context?.documentary_processing?.link_state || "");
  if (linkState === "auto_linked") return "Vinculada automáticamente";
  if (linkState === "suggested_review") return "Pendiente de revisión manual";
  if (linkState === "unlinked") return "No vinculada automáticamente";
  return statusEs(row?.verification_requests?.status || "processing");
}

export default async function CandidateEvidencePage(props: any) {
  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();
  if (!au.user) redirect("/login");
  const searchParams = (await props?.searchParams) || {};
  const preselectedExperienceId = String(searchParams?.experience_id || "").trim();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, onboarding_completed")
    .eq("id", au.user.id)
    .single();
  if (!profile || !profile.onboarding_completed) redirect("/onboarding");

  const { data: evidences } = await supabase
    .from("evidences")
    .select("id, verification_request_id, storage_path, created_at, verification_requests(status, request_context, employment_records(position, company_name_freeform))")
    .eq("uploaded_by", au.user.id)
    .order("created_at", { ascending: false });

  const { data: employmentRows } = await supabase
    .from("employment_records")
    .select("id,position,company_name_freeform,start_date,end_date")
    .eq("candidate_id", au.user.id)
    .order("start_date", { ascending: false });

  const experienceOptions: ExperienceOption[] = (employmentRows || []).map((row: any) => {
    const position = String(row.position || "Experiencia").trim();
    const company = String(row.company_name_freeform || "Empresa").trim();
    const period = [row.start_date || "—", row.end_date || "Actualidad"].join(" · ");
    return {
      id: String(row.id),
      label: `${position} — ${company} (${period})`,
    };
  });

  const items: EvidenceItem[] = (evidences || []).map((r: any) => {
    const vr = Array.isArray(r.verification_requests) ? r.verification_requests[0] : r.verification_requests;
    const er = Array.isArray(vr?.employment_records) ? vr.employment_records[0] : vr?.employment_records;
    const docName = String(r.storage_path || "documento").split("/").pop() || "documento";
    return {
      id: r.id,
      document_name: docName,
      experience: [er?.position, er?.company_name_freeform].filter(Boolean).join(" · ") || "Experiencia no vinculada",
      status: documentaryStatusEs(r),
      created_at: r.created_at || null,
    };
  });

  return (
    <DashboardShell title="Evidencias">
      <EvidenceListClient
        initialItems={items}
        experienceOptions={experienceOptions}
        preselectedExperienceId={preselectedExperienceId}
      />
    </DashboardShell>
  );
}
