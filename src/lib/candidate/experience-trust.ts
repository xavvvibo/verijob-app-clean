import {
  EMPLOYMENT_RECORD_VERIFICATION_STATUS,
  normalizeEmploymentRecordVerificationStatus,
} from "@/lib/verification/employment-record-verification-status";

export type CandidateExperienceTrustItem = {
  id: string;
  profile_experience_id: string;
  employment_record_id: string | null;
  role_title: string | null;
  company_name: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  status_label: "Alta confianza" | "Confianza media" | "Verificación en proceso" | "Sin validar todavía";
  status_tone: string;
  support_label: "Con documentación aportada" | null;
  explanation: string;
  next_action_label: "Solicitar verificación" | "Añadir documentación" | "Esperando respuesta" | null;
  next_action_href: string | null;
  evidence_count: number;
};

type ProfileExperienceRow = {
  id?: string | null;
  role_title?: string | null;
  company_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  description?: string | null;
  matched_verification_id?: string | null;
  created_at?: string | null;
};

type EmploymentRecordRow = {
  id?: string | null;
  position?: string | null;
  company_name_freeform?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  verification_status?: string | null;
  last_verification_request_id?: string | null;
};

type VerificationSummaryRow = {
  verification_id?: string | null;
  status?: string | null;
  evidence_count?: number | null;
  evidences_count?: number | null;
};

function norm(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function experienceMatchKey(input: any) {
  return [
    norm(input?.role_title ?? input?.position),
    norm(input?.company_name ?? input?.company_name_freeform),
    norm(input?.start_date),
    norm(input?.end_date),
  ].join("|");
}

export function resolveExperienceTrustPresentation(args: {
  rawStatus: unknown;
  evidenceCount: number;
}) {
  const normalizedStatus = normalizeEmploymentRecordVerificationStatus(args.rawStatus);
  const evidenceCount = Math.max(0, Number(args.evidenceCount || 0));

  if (normalizedStatus === EMPLOYMENT_RECORD_VERIFICATION_STATUS.VERIFIED) {
    return {
      status_label: "Alta confianza" as const,
      status_tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
      support_label: evidenceCount > 0 ? ("Con documentación aportada" as const) : null,
      explanation:
        evidenceCount > 0
          ? "Experiencia verificada y reforzada con documentación."
          : "Experiencia verificada.",
      next_action_label: null,
      next_action_href: null,
    };
  }

  if (normalizedStatus === EMPLOYMENT_RECORD_VERIFICATION_STATUS.VERIFICATION_REQUESTED) {
    return {
      status_label: "Verificación en proceso" as const,
      status_tone: "border-amber-200 bg-amber-50 text-amber-800",
      support_label: evidenceCount > 0 ? ("Con documentación aportada" as const) : null,
      explanation:
        evidenceCount > 0
          ? "La validación está en curso y ya cuenta con documentación de apoyo."
          : "La validación está en curso.",
      next_action_label: evidenceCount > 0 ? ("Esperando respuesta" as const) : ("Añadir documentación" as const),
      next_action_href: evidenceCount > 0 ? null : "/candidate/evidence",
    };
  }

  if (evidenceCount > 0) {
    return {
      status_label: "Confianza media" as const,
      status_tone: "border-blue-200 bg-blue-50 text-blue-800",
      support_label: "Con documentación aportada" as const,
      explanation: "Aún no está verificada, pero ya cuenta con documentación aportada.",
      next_action_label: "Solicitar verificación" as const,
      next_action_href: "/candidate/verifications/new",
    };
  }

  return {
    status_label: "Sin validar todavía" as const,
    status_tone: "border-slate-200 bg-slate-50 text-slate-700",
    support_label: null,
    explanation: "Todavía no tiene verificación registrada.",
    next_action_label: "Solicitar verificación" as const,
    next_action_href: "/candidate/verifications/new",
  };
}

export function buildCandidateExperienceTrustTimeline(args: {
  profileExperiences: ProfileExperienceRow[];
  employmentRecords: EmploymentRecordRow[];
  verificationSummaries: VerificationSummaryRow[];
}) {
  const employmentBySignature = new Map<string, EmploymentRecordRow>();
  for (const row of args.employmentRecords || []) {
    const key = experienceMatchKey(row);
    if (key && !employmentBySignature.has(key)) {
      employmentBySignature.set(key, row);
    }
  }

  const verificationById = new Map<string, VerificationSummaryRow>();
  for (const row of args.verificationSummaries || []) {
    const key = String(row?.verification_id || "");
    if (key) verificationById.set(key, row);
  }

  return (args.profileExperiences || []).map((row) => {
    const employmentRecord = employmentBySignature.get(experienceMatchKey(row));
    const verificationId = String(
      row?.matched_verification_id || employmentRecord?.last_verification_request_id || "",
    );
    const verificationSummary = verificationId ? verificationById.get(verificationId) : null;
    const evidenceCount = Number(
      verificationSummary?.evidence_count ?? verificationSummary?.evidences_count ?? 0,
    );
    const presentation = resolveExperienceTrustPresentation({
      rawStatus: verificationSummary?.status || employmentRecord?.verification_status || null,
      evidenceCount,
    });

    return {
      id: String(row?.id || employmentRecord?.id || ""),
      profile_experience_id: String(row?.id || ""),
      employment_record_id: employmentRecord?.id ? String(employmentRecord.id) : null,
      role_title: row?.role_title ?? employmentRecord?.position ?? null,
      company_name: row?.company_name ?? employmentRecord?.company_name_freeform ?? null,
      start_date: row?.start_date ?? employmentRecord?.start_date ?? null,
      end_date: row?.end_date ?? employmentRecord?.end_date ?? null,
      description: row?.description ?? null,
      evidence_count: evidenceCount,
      ...presentation,
    } satisfies CandidateExperienceTrustItem;
  });
}
