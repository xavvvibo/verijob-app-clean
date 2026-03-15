export type CompanyCandidateWorkspaceRow = {
  id: string;
  candidate_email?: string | null;
  candidate_name_raw?: string | null;
  linked_profile_name?: string | null;
  target_role?: string | null;
  display_status?: string | null;
  trust_score?: number | null;
  total_verifications?: number | null;
  approved_verifications?: number | null;
  candidate_public_token?: string | null;
  linked_user_id?: string | null;
  candidate_already_exists?: boolean | null;
  company_stage?: "none" | "saved" | "preselected" | string | null;
  last_activity_at?: string | null;
  created_at?: string | null;
  access_status?: "active" | "expired" | "never" | string | null;
  access_expires_at?: string | null;
  partial_sector?: string | null;
  partial_years_experience?: number | null;
  partial_location?: string | null;
};

export type CandidateQuickFitLevel = "high" | "medium" | "low";
export type CandidatePipelineBucket = "review" | "validation" | "decision";
export type CandidateTrustBand = "high" | "medium" | "low" | "none";
export type CandidateProfileReadiness = "complete" | "incomplete";

export function resolveCandidateDisplayName(row: CompanyCandidateWorkspaceRow) {
  return row.linked_profile_name || row.candidate_name_raw || row.candidate_email || "Candidato";
}

export function resolveCandidatePartialName(row: CompanyCandidateWorkspaceRow) {
  const source = resolveCandidateDisplayName(row);
  const email = String(row.candidate_email || "").trim();
  const name = String(source || "").trim();

  if (name && !name.includes("@")) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0]} ${parts[1].charAt(0).toUpperCase()}.`;
    return parts[0];
  }

  if (email) {
    const local = email.split("@")[0]?.trim() || "Candidato";
    return local.charAt(0).toUpperCase() + local.slice(1);
  }

  return "Candidato";
}

export function resolveCandidateSector(row: CompanyCandidateWorkspaceRow) {
  return String(row.partial_sector || "").trim() || "Sector no especificado";
}

export function resolveCandidateYearsExperience(row: CompanyCandidateWorkspaceRow) {
  const years = Number(row.partial_years_experience ?? 0);
  if (!Number.isFinite(years) || years <= 0) return "Experiencia no especificada";
  return `${years} año${years === 1 ? "" : "s"}`;
}

export function resolveCandidateApproxLocation(row: CompanyCandidateWorkspaceRow) {
  return String(row.partial_location || "").trim() || "Ubicación no especificada";
}

export function resolveCandidateAvailableVerifications(row: CompanyCandidateWorkspaceRow) {
  return Math.max(0, Number(row.total_verifications || 0));
}

export function resolveCandidatePipelineBucket(row: CompanyCandidateWorkspaceRow): CandidatePipelineBucket {
  const status = String(row.display_status || "").toLowerCase();
  if (status === "verified" || status === "existing_candidate") return "decision";
  if (status === "verifying" || status === "profile_created") return "validation";
  return "review";
}

export function resolveCandidatePipelineLabel(bucket: CandidatePipelineBucket) {
  if (bucket === "decision") return "Listos para decisión";
  if (bucket === "validation") return "En validación";
  return "Por revisar";
}

export function resolveCandidateTrustBand(row: CompanyCandidateWorkspaceRow): CandidateTrustBand {
  const trust = Number(row.trust_score ?? 0);
  if (!Number.isFinite(trust) || trust <= 0) return "none";
  if (trust >= 70) return "high";
  if (trust >= 40) return "medium";
  return "low";
}

export function resolveCandidateProfileReadiness(row: CompanyCandidateWorkspaceRow): CandidateProfileReadiness {
  const hasProfile = Boolean(row.linked_user_id && row.candidate_public_token);
  const status = String(row.display_status || "").toLowerCase();
  return hasProfile && !["acceptance_pending", "processing", "uploaded", "parse_failed"].includes(status)
    ? "complete"
    : "incomplete";
}

export function isCandidateVerified(row: CompanyCandidateWorkspaceRow) {
  return String(row.display_status || "").toLowerCase() === "verified" || Number(row.approved_verifications || 0) > 0;
}

export function computeCandidateQuickFit(row: CompanyCandidateWorkspaceRow): {
  level: CandidateQuickFitLevel;
  label: string;
  tone: string;
  summary: string;
  reasons: string[];
} {
  let points = 0;
  const reasons: string[] = [];
  const trust = Number(row.trust_score ?? 0);
  const approved = Number(row.approved_verifications || 0);
  const total = Number(row.total_verifications || 0);
  const pipeline = resolveCandidatePipelineBucket(row);
  const readiness = resolveCandidateProfileReadiness(row);

  if (trust >= 70) {
    points += 3;
    reasons.push(`Trust score alto (${trust})`);
  } else if (trust >= 40) {
    points += 2;
    reasons.push(`Trust score medio (${trust})`);
  } else if (trust > 0) {
    points += 1;
    reasons.push(`Trust score inicial (${trust})`);
  }

  if (approved >= 2) {
    points += 3;
    reasons.push(`${approved} verificaciones aprobadas`);
  } else if (approved === 1) {
    points += 2;
    reasons.push("Ya tiene una verificación aprobada");
  } else if (total >= 2) {
    points += 1;
    reasons.push(`${total} verificaciones registradas`);
  }

  if (readiness === "complete") {
    points += 1;
    reasons.push("Perfil listo para revisar");
  }

  if (String(row.access_status || "").toLowerCase() === "active") {
    points += 1;
    reasons.push("Acceso activo al perfil completo");
  }

  if (pipeline === "decision") {
    points += 2;
    reasons.push("Ya está en fase de decisión");
  } else if (pipeline === "validation") {
    points += 1;
    reasons.push("Está avanzando en validación");
  }

  if (String(row.company_stage || "").toLowerCase() === "preselected") {
    points += 1;
    reasons.push("Ya está preseleccionado en tu pipeline");
  }

  if (points >= 7) {
    return {
      level: "high",
      label: "Encaje alto",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
      summary: reasons.slice(0, 2).join(" · "),
      reasons,
    };
  }
  if (points >= 4) {
    return {
      level: "medium",
      label: "Encaje medio",
      tone: "border-amber-200 bg-amber-50 text-amber-800",
      summary: reasons.slice(0, 2).join(" · "),
      reasons,
    };
  }
  return {
    level: "low",
    label: "Encaje bajo",
    tone: "border-slate-200 bg-slate-100 text-slate-700",
    summary: reasons[0] || "Todavía faltan señales suficientes para priorizarlo mejor.",
    reasons: reasons.length ? reasons : ["Todavía faltan señales suficientes para priorizarlo mejor."],
  };
}
