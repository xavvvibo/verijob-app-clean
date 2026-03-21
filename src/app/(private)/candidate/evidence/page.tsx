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
  scope_label: string;
  processing_label: string;
  trust_label: string | null;
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

  if (experienceOptions.length === 0) {
    experienceOptions.push(
      ...((profileExperienceRows || []).map((row: any) => {
        const position = String(row.role_title || "Experiencia").trim();
        const company = String(row.company_name || "Empresa").trim();
        const period = [row.start_date || "—", row.end_date || "Actualidad"].join(" · ");
        return {
          id: `profile:${String(row.id)}`,
          label: `${position} — ${company} (${period})`,
        };
      }) as ExperienceOption[]),
    );
  }

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
    const processingStatus = String(processing?.status || "").toLowerCase();
    const linkState = String(processing?.link_state || "").toLowerCase();
    const scopeLabel = scope === "global" ? "Evidencia global" : "Evidencia asociada a una experiencia";
    const processingLabel =
      processingStatus === "queued"
        ? "Archivo recibido. Pendiente de análisis."
        : processingStatus === "processing"
          ? "Documento en análisis."
          : processingStatus === "processed" && linkState === "auto_linked"
            ? "Documento procesado y vinculado automáticamente."
            : processingStatus === "processed"
              ? "Documento procesado. Está pendiente de revisión."
              : processingStatus === "failed"
                ? "No pudimos completar el análisis automático. Queda pendiente de revisión."
                : "Documento registrado.";
    const trustLabel =
      String(r?.validation_status || "").toLowerCase() === "approved"
        ? "Ya está reforzando tu Trust Score."
        : Number(r?.trust_weight ?? 0) > 0
          ? "Puede reforzar tu Trust Score cuando termine la validación."
          : null;
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
      scope_label: scopeLabel,
      processing_label: processingLabel,
      trust_label: trustLabel,
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
