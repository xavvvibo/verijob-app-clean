import { redirect } from "next/navigation";
import DashboardShell from "@/app/_components/DashboardShell";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import EvidenceListClient from "./EvidenceListClient";
import {
  getEvidenceTypeLabel,
  toEvidenceUiStatusWithReason,
} from "@/lib/candidate/evidence-types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type EvidenceItem = {
  id: string;
  document_name: string;
  document_type: string;
  experience: string;
  status: string;
  reason: string | null;
  created_at: string | null;
};

type ExperienceOption = {
  id: string;
  label: string;
};

export default async function CandidateEvidencePage(props: any) {
  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();
  if (!au.user) redirect("/login");
  const searchParams = (await props?.searchParams) || {};
  const preselectedExperienceId = String(searchParams?.experience_id || "").trim();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", au.user.id)
    .single();
  if (!profile) redirect("/onboarding");

  const { data: evidences } = await supabase
    .from("evidences")
    .select("id, verification_request_id, created_at, evidence_type, document_type, document_scope, validation_status, inconsistency_reason, trust_weight, verification_requests(status, request_context, employment_record_id, employment_records(position, company_name_freeform))")
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
    const processing = vr?.request_context?.documentary_processing || {};
    const ui = toEvidenceUiStatusWithReason({
      validationStatus: r?.validation_status || vr?.status,
      inconsistencyReason: r?.inconsistency_reason || processing?.inconsistency_reason,
      matchingReason: processing?.matching_reason,
      error: processing?.error,
      fallbackReason:
        String(processing?.status || "").toLowerCase() === "queued"
          ? "Evidencia recibida. La estamos analizando."
          : String(processing?.status || "").toLowerCase() === "processing"
            ? "Estamos analizando el documento."
            : null,
    });
    const scope = String(r?.document_scope || vr?.request_context?.documentary_scope || "").toLowerCase();
    return {
      id: r.id,
      document_name: getEvidenceTypeLabel(r?.document_type || r?.evidence_type),
      document_type: getEvidenceTypeLabel(r?.document_type || r?.evidence_type),
      experience:
        scope === "global"
          ? "Varias experiencias"
          : [er?.position, er?.company_name_freeform].filter(Boolean).join(" — ") || "Experiencia no vinculada",
      status: ui.status,
      reason: ui.reason || null,
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
