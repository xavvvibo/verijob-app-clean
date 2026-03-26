import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import EvidenceListClient from "./EvidenceListClient";
import { buildEvidenceUiItem } from "@/lib/candidate/evidence-ui";
import CandidatePageHeader from "../_components/CandidatePageHeader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type EvidenceItem = {
  id: string;
  evidence_id: string;
  verification_request_id: string | null;
  employment_record_id: string | null;
  document_name: string;
  document_type: string;
  evidence_type_key: string;
  experience: string;
  dates: string | null;
  status: string;
  reason: string | null;
  created_at: string | null;
  scope_label: string;
  processing_status: string;
  analysis_completed: boolean;
  processing_label: string;
  trust_label: string | null;
  trust_impact: string;
  match_level: string;
  match_label: string;
  match_summary: string | null;
  supports_multiple_experiences: boolean;
  supporting_employment_record_ids: string[];
  supporting_experiences_label: string | null;
  identity_status_label: string | null;
  extracted_employment_entries: Array<{
    entry_id: string;
    type: string;
    company_name: string;
    position: string | null;
    start_date: string | null;
    end_date: string | null;
    confidence: number;
    ignored_reason: string | null;
    suggested_match_employment_record_id: string | null;
    linked_employment_record_id: string | null;
    reconciliation_status: string;
    reconciliation_choice: string | null;
    raw_text: string | null;
  }>;
  grouped_employment_entries: Array<{
    entry_id: string;
    type: string;
    subtype: string | null;
    self_employment: boolean;
    company_name: string;
    normalized_company_key: string | null;
    start_date: string | null;
    end_date: string | null;
    is_current: boolean;
    confidence: number;
    group_score: number;
    province_prefix: string | null;
    province_hint: string | null;
    suggested_match_employment_record_id: string | null;
    linked_employment_record_id: string | null;
    reconciliation_status: string;
    reconciliation_choice: string | null;
    source_entry_count: number;
    source_entry_ids: string[];
    source_block_indexes: number[];
    classification_reasons: string[];
    concise_summary: string | null;
    raw_text: string | null;
  }>;
  reconciliation_summary: {
    linked_existing_count: number;
    created_count: number;
    ignored_count: number;
    auto_ignored_count: number;
    pending_count: number;
    material_changes: boolean;
    linked_employment_record_ids: string[];
    created_profile_experience_ids: string[];
    auto_verified_count: number;
    auto_verified_employment_record_ids: string[];
    message: string;
  } | null;
  person_check_label: string;
  company_check_label: string;
  date_check_label: string;
  position_check_label: string;
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
    .select("id, verification_request_id, created_at, evidence_type, document_type, document_scope, validation_status, inconsistency_reason, trust_weight, verification_requests(id, status, request_context, employment_record_id, employment_records(id, position, company_name_freeform, start_date, end_date, is_current))")
    .eq("uploaded_by", au.user.id)
    .order("created_at", { ascending: false });

  const { data: employmentRows } = await supabase
    .from("employment_records")
    .select("id,position,company_name_freeform,start_date,end_date")
    .eq("candidate_id", au.user.id)
    .order("start_date", { ascending: false });

  const { data: profileExperienceRows } = await supabase
    .from("profile_experiences")
    .select("id,role_title,company_name,start_date,end_date")
    .eq("user_id", au.user.id)
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
  const existingLabels = new Set(experienceOptions.map((item) => item.label));
  for (const row of profileExperienceRows || []) {
    const position = String((row as any).role_title || "Experiencia").trim();
    const company = String((row as any).company_name || "Empresa").trim();
    const period = [(row as any).start_date || "—", (row as any).end_date || "Actualidad"].join(" · ");
    const label = `${position} — ${company} (${period})`;
    if (existingLabels.has(label)) continue;
    existingLabels.add(label);
    experienceOptions.push({
      id: `profile:${String((row as any).id)}`,
      label,
    });
  }

  const items = (evidences || []).map((r: any) => buildEvidenceUiItem(r));

  return (
    <div className="mx-auto max-w-[1440px] space-y-16 px-8 py-12">
      <CandidatePageHeader
        eyebrow="Evidencias"
        title="Documentos que refuerzan tu perfil"
        description="Sube documentación clara, relaciónala con la experiencia correcta y sigue su estado sin ruido técnico."
        badges={["Documentos vinculados", "Estado documental", "Refuerzo de confianza"]}
      />
      <EvidenceListClient
        initialItems={items}
        experienceOptions={experienceOptions}
        preselectedExperienceId={preselectedExperienceId}
      />
    </div>
  );
}
