function normalizeVerificationStatus(value) {
  const status = String(value || "").trim().toLowerCase();

  if (!status) return "unverified";
  if (status === "verified" || status === "approved" || status === "verified_document" || status === "verified_paid") {
    return "verified";
  }
  if (status === "rejected" || status === "revoked") return "rejected";
  if (
    status === "verification_requested" ||
    status === "pending_company" ||
    status === "reviewing" ||
    status === "requested" ||
    status === "company_registered_pending" ||
    status === "in_review"
  ) {
    return "verification_requested";
  }
  return "unverified";
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function computeCandidateOverviewMetrics({
  verifications = [],
  employmentRecords = [],
  experienceCount = 0,
  trustScore = null,
}) {
  const employmentStatuses = employmentRecords.map((row) => normalizeVerificationStatus(row?.verification_status));
  const verificationStatuses = verifications.map((row) => normalizeVerificationStatus(row?.status));

  const verified = employmentStatuses.filter((status) => status === "verified").length;
  const inProcessEmployment = employmentStatuses.filter((status) => status === "verification_requested").length;
  const rejected = employmentStatuses.filter((status) => status === "rejected").length;
  const inProcessRequests = verificationStatuses.filter((status) => status === "verification_requested").length;
  const inProcess = Math.max(inProcessEmployment, inProcessRequests);
  const confirmed = verifications.filter((row) => Boolean(row?.company_confirmed)).length;
  const evidences = verifications.reduce((acc, row) => acc + Number(row?.evidence_count || 0), 0);
  const trackedEmployment = employmentStatuses.filter((status) => status !== "unverified").length;
  const tracked = Math.max(trackedEmployment, verified + inProcess + rejected, confirmed);
  const denominator = Math.max(1, experienceCount, tracked, verified + inProcess);
  const baseScore = Math.round(
    ((verified / denominator) * 0.5 + (confirmed / denominator) * 0.3 + Math.min(1, evidences / Math.max(1, denominator * 2)) * 0.2) * 100,
  );

  return {
    total: tracked,
    tracked,
    verified,
    inProcess,
    confirmed,
    evidences,
    rejected,
    score: trustScore == null ? baseScore : clamp(Number(trustScore || 0)),
  };
}

export function resolveCandidateOverviewStatus({ experienceCount = 0, metrics }) {
  if (metrics.verified > 0) return "Perfil listo para empresas";
  if (metrics.inProcess > 0) return "Solicitud enviada";
  if (metrics.rejected > 0) return "Revisa tu verificacion";
  if (experienceCount > 0) return "Perfil iniciado";
  return "Perfil por activar";
}

export function buildCandidateOverviewNextActions({ experienceCount = 0, metrics, profileCompletionScore = 0 }) {
  const actions = [];

  if (experienceCount === 0) {
    actions.push({ label: "Anadir tu primera experiencia", href: "/candidate/experience?new=1#manual-experience" });
  }

  if (experienceCount > 0 && metrics.verified === 0 && metrics.inProcess === 0) {
    actions.push({ label: "Enviar una verificacion", href: "/candidate/verifications/new" });
  }

  if ((metrics.inProcess > 0 || metrics.verified > 0) && metrics.evidences === 0) {
    actions.push({ label: "Subir documentacion", href: "/candidate/evidence" });
  }

  if (profileCompletionScore < 70) {
    actions.push({ label: "Completar tu perfil", href: "/candidate/profile" });
  }

  return actions.slice(0, 3);
}
