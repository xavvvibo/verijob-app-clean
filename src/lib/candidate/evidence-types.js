const EVIDENCE_TYPE_CONFIGS = {
  vida_laboral: {
    key: "vida_laboral",
    label: "Fe de vida laboral actualizada (máximo 6 meses de antigüedad)",
    helper:
      "Puede servir para varias o todas tus experiencias.",
    requiresExperience: false,
    scope: "global",
    trustWeight: 20,
  },
  contrato_trabajo: {
    key: "contrato_trabajo",
    label: "Contrato de trabajo",
    helper: "Debe asociarse a una experiencia concreta.",
    requiresExperience: true,
    scope: "experience",
    trustWeight: 10,
  },
  nomina: {
    key: "nomina",
    label: "Nómina",
    helper: "Debe asociarse a una experiencia concreta.",
    requiresExperience: true,
    scope: "experience",
    trustWeight: 6,
  },
  certificado_empresa: {
    key: "certificado_empresa",
    label: "Certificado de empresa",
    helper: "Debe asociarse a una experiencia concreta.",
    requiresExperience: true,
    scope: "experience",
    trustWeight: 8,
  },
  otro_documento: {
    key: "otro_documento",
    label: "Otro documento",
    helper: "Debe asociarse a una experiencia concreta.",
    requiresExperience: true,
    scope: "experience",
    trustWeight: 0,
  },
};

const LEGACY_TYPE_ALIASES = {
  documentary: "otro_documento",
  documento: "otro_documento",
  contrato: "contrato_trabajo",
  certificado: "certificado_empresa",
  vida_laboral_actualizada: "vida_laboral",
};

const EVIDENCE_VALIDATION_INTERNAL = {
  UPLOADED: "uploaded",
  AUTO_PROCESSING: "auto_processing",
  NEEDS_REVIEW: "needs_review",
  APPROVED: "approved",
  REJECTED: "rejected",
};

function normalizeEvidenceType(type) {
  const raw = String(type || "").trim().toLowerCase();
  if (!raw) return "otro_documento";
  if (EVIDENCE_TYPE_CONFIGS[raw]) return raw;
  if (LEGACY_TYPE_ALIASES[raw]) return LEGACY_TYPE_ALIASES[raw];
  if (raw.includes("vida")) return "vida_laboral";
  if (raw.includes("nomina")) return "nomina";
  if (raw.includes("contrato")) return "contrato_trabajo";
  if (raw.includes("certificado")) return "certificado_empresa";
  return "otro_documento";
}

function getEvidenceTypeConfig(type) {
  const key = normalizeEvidenceType(type);
  return EVIDENCE_TYPE_CONFIGS[key];
}

function getEvidenceTypeLabel(type) {
  return getEvidenceTypeConfig(type).label;
}

function getEvidenceTypeWeight(type) {
  return Number(getEvidenceTypeConfig(type).trustWeight || 0);
}

function getEvidenceTrustImpact(type) {
  const normalized = normalizeEvidenceType(type);
  if (normalized === "vida_laboral") return "alta";
  if (normalized === "contrato_trabajo" || normalized === "certificado_empresa") return "media";
  if (normalized === "nomina") return "baja-media";
  return "baja";
}

function requiresExperienceAssociation(type) {
  return Boolean(getEvidenceTypeConfig(type).requiresExperience);
}

function getEvidenceTrustWeightsMap() {
  return Object.values(EVIDENCE_TYPE_CONFIGS).reduce((acc, item) => {
    acc[item.key] = item.trustWeight;
    return acc;
  }, {});
}

function getEvidenceTypeOptions() {
  return Object.values(EVIDENCE_TYPE_CONFIGS).map((item) => ({
    key: item.key,
    label: item.label,
    helper: item.helper,
    requiresExperience: item.requiresExperience,
    scope: item.scope,
    trustWeight: item.trustWeight,
  }));
}

function normalizeValidationStatus(status) {
  const raw = String(status || "").trim().toLowerCase();
  if (!raw) return EVIDENCE_VALIDATION_INTERNAL.NEEDS_REVIEW;
  if (raw === EVIDENCE_VALIDATION_INTERNAL.UPLOADED) return EVIDENCE_VALIDATION_INTERNAL.UPLOADED;
  if (raw === EVIDENCE_VALIDATION_INTERNAL.AUTO_PROCESSING) return EVIDENCE_VALIDATION_INTERNAL.AUTO_PROCESSING;
  if (raw === EVIDENCE_VALIDATION_INTERNAL.NEEDS_REVIEW) return EVIDENCE_VALIDATION_INTERNAL.NEEDS_REVIEW;
  if (raw === EVIDENCE_VALIDATION_INTERNAL.APPROVED || raw.includes("verified")) {
    return EVIDENCE_VALIDATION_INTERNAL.APPROVED;
  }
  if (raw === EVIDENCE_VALIDATION_INTERNAL.REJECTED || raw.includes("rejected") || raw.includes("revoked")) {
    return EVIDENCE_VALIDATION_INTERNAL.REJECTED;
  }
  if (raw.includes("process") || raw.includes("reviewing") || raw.includes("pending")) {
    return EVIDENCE_VALIDATION_INTERNAL.AUTO_PROCESSING;
  }
  return EVIDENCE_VALIDATION_INTERNAL.NEEDS_REVIEW;
}

function toEvidenceUiStatus(validationStatus) {
  const normalized = normalizeValidationStatus(validationStatus);
  if (normalized === EVIDENCE_VALIDATION_INTERNAL.APPROVED) return "Aprobada";
  if (normalized === EVIDENCE_VALIDATION_INTERNAL.REJECTED) return "Rechazada";
  return "En proceso de validación";
}

/**
 * @param {{
 *  validationStatus?: any;
 *  inconsistencyReason?: any;
 *  matchingReason?: any;
 *  error?: any;
 *  fallbackReason?: any;
 * }} params
 */
function toEvidenceUiStatusWithReason({
  validationStatus,
  inconsistencyReason,
  matchingReason,
  error,
  fallbackReason = null,
} = {}) {
  const ui = toEvidenceUiStatus(validationStatus);
  const reason =
    String(inconsistencyReason || matchingReason || error || fallbackReason || "").trim() ||
    (ui === "Aprobada"
      ? "Documento aprobado y asociado a la experiencia."
      : ui === "Rechazada"
        ? "Documento rechazado durante la validación."
        : "Pendiente de revisión manual");
  return { status: ui, reason };
}

module.exports = {
  EVIDENCE_TYPE_CONFIGS,
  LEGACY_TYPE_ALIASES,
  EVIDENCE_VALIDATION_INTERNAL,
  normalizeEvidenceType,
  getEvidenceTypeConfig,
  getEvidenceTypeLabel,
  getEvidenceTypeWeight,
  getEvidenceTrustImpact,
  getEvidenceTrustWeightsMap,
  getEvidenceTypeOptions,
  normalizeValidationStatus,
  toEvidenceUiStatus,
  toEvidenceUiStatusWithReason,
  requiresExperienceAssociation,
};
