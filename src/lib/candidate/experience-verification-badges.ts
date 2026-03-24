export type ExperienceVerificationBadgeKey =
  | "vida_laboral"
  | "contrato"
  | "nomina"
  | "certificado_empresa"
  | "documental"
  | "empresa"
  | "peer";

export type ExperienceVerificationBadge = {
  key: ExperienceVerificationBadgeKey;
  label: string;
  priority: number;
  tone: "documentary_strong" | "documentary" | "company" | "peer";
  sourceType: "documentary_exact" | "documentary_generic" | "company" | "peer" | "legacy";
};

type ResolveArgs = {
  verificationChannel?: unknown;
  verificationStatus?: unknown;
  companyConfirmed?: unknown;
  companyVerificationStatusSnapshot?: unknown;
  evidenceCount?: unknown;
  verificationBadges?: unknown;
  documentType?: unknown;
  evidenceType?: unknown;
  requestContext?: unknown;
  evidences?: Array<{
    document_type?: unknown;
    evidence_type?: unknown;
  }> | null;
};

const BADGE_PRIORITY: Record<ExperienceVerificationBadgeKey, number> = {
  vida_laboral: 600,
  contrato: 500,
  nomina: 400,
  certificado_empresa: 300,
  documental: 200,
  empresa: 120,
  peer: 80,
};

const BADGE_META: Record<
  ExperienceVerificationBadgeKey,
  Pick<ExperienceVerificationBadge, "label" | "tone" | "sourceType">
> = {
  vida_laboral: {
    label: "Vida laboral",
    tone: "documentary_strong",
    sourceType: "documentary_exact",
  },
  contrato: {
    label: "Contrato",
    tone: "documentary_strong",
    sourceType: "documentary_exact",
  },
  nomina: {
    label: "Nómina",
    tone: "documentary_strong",
    sourceType: "documentary_exact",
  },
  certificado_empresa: {
    label: "Certificado de empresa",
    tone: "documentary_strong",
    sourceType: "documentary_exact",
  },
  documental: {
    label: "Documental validado",
    tone: "documentary",
    sourceType: "documentary_generic",
  },
  empresa: {
    label: "Verificación empresa",
    tone: "company",
    sourceType: "company",
  },
  peer: {
    label: "Validado por compañero",
    tone: "peer",
    sourceType: "peer",
  },
};

function norm(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function toArray(value: unknown) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function hasVerifiedCompanySignal(args: ResolveArgs) {
  const channel = norm(args.verificationChannel);
  const verificationStatus = norm(args.verificationStatus);
  const snapshot = norm(args.companyVerificationStatusSnapshot);
  return (
    channel === "email" ||
    channel === "company" ||
    channel === "empresa" ||
    verificationStatus === "approved" ||
    verificationStatus === "verified" ||
    verificationStatus === "verified_document" ||
    snapshot === "verified" ||
    snapshot === "approved" ||
    Boolean(args.companyConfirmed)
  );
}

function badgeFromToken(rawValue: unknown): ExperienceVerificationBadgeKey | null {
  const value = norm(rawValue);
  if (!value) return null;
  if (value.includes("vida_laboral") || value.includes("social_security")) return "vida_laboral";
  if (value.includes("certificado_empresa") || value.includes("company_certificate")) return "certificado_empresa";
  if (value.includes("contrato")) return "contrato";
  if (value.includes("nomina") || value.includes("nómina") || value.includes("payroll")) return "nomina";
  if (value.includes("verificación empresa") || value.includes("verificacion empresa")) return "empresa";
  if (value.includes("validado por compañero")) return "peer";
  if (value.includes("peer")) return "peer";
  if (value.includes("empresa") || value.includes("company") || value.includes("email")) return "empresa";
  if (value.includes("documental")) return "documental";
  return null;
}

function isDocumentaryOfficialVerification(args: ResolveArgs) {
  const channel = norm(args.verificationChannel);
  const requestContext = asObject(args.requestContext);
  const documentaryProcessing = asObject(requestContext.documentary_processing);
  const source = norm(requestContext.verification_source || documentaryProcessing.verification_source);
  const method = norm(requestContext.verification_method || documentaryProcessing.verification_method);
  const reason = norm(requestContext.verification_reason || documentaryProcessing.verification_reason);
  return channel === "documentary" && (
    source === "documentary_official" ||
    method === "official_document_auto" ||
    reason === "vida_laboral_linked_high_confidence" ||
    reason === "vida_laboral_cea_verified_signal"
  );
}

function collectBadgeTokens(args: ResolveArgs) {
  const requestContext = asObject(args.requestContext);
  const documentaryProcessing = asObject(requestContext.documentary_processing);
  const legacyBadges = toArray(args.verificationBadges);
  const evidences = Array.isArray(args.evidences) ? args.evidences : [];

  return [
    args.documentType,
    args.evidenceType,
    requestContext.document_type,
    requestContext.evidence_type,
    requestContext.documentType,
    requestContext.evidenceType,
    requestContext.verification_type,
    documentaryProcessing.document_type,
    documentaryProcessing.evidence_type,
    documentaryProcessing.matched_document_type,
    documentaryProcessing.documentType,
    documentaryProcessing.evidenceType,
    documentaryProcessing.detected_document_type,
    documentaryProcessing.primary_document_type,
    documentaryProcessing.document_classification,
    ...legacyBadges,
    ...evidences.flatMap((item) => [item?.document_type, item?.evidence_type]),
  ];
}

function makeBadge(key: ExperienceVerificationBadgeKey, sourceType?: ExperienceVerificationBadge["sourceType"]) {
  const meta = BADGE_META[key];
  return {
    key,
    label: meta.label,
    priority: BADGE_PRIORITY[key],
    tone: meta.tone,
    sourceType: sourceType || meta.sourceType,
  } satisfies ExperienceVerificationBadge;
}

export function resolveExperienceVerificationBadges(args: ResolveArgs): ExperienceVerificationBadge[] {
  const badges = new Map<ExperienceVerificationBadgeKey, ExperienceVerificationBadge>();
  const tokens = collectBadgeTokens(args);

  for (const token of tokens) {
    const key = badgeFromToken(token);
    if (!key || key === "documental" || key === "empresa" || key === "peer") continue;
    if (!badges.has(key)) badges.set(key, makeBadge(key));
  }

  if (!badges.size) {
    const legacyBadges = toArray(args.verificationBadges);
    for (const token of legacyBadges) {
      const key = badgeFromToken(token);
      if (!key || key === "vida_laboral" || key === "contrato" || key === "nomina" || key === "certificado_empresa") continue;
      if (!badges.has(key)) badges.set(key, makeBadge(key, "legacy"));
    }
  }

  const hasDocumentarySignal =
    badges.has("vida_laboral") ||
    badges.has("contrato") ||
    badges.has("nomina") ||
    badges.has("certificado_empresa") ||
    isDocumentaryOfficialVerification(args) ||
    norm(args.verificationChannel) === "documentary" ||
    Number(args.evidenceCount ?? 0) > 0 ||
    toArray(args.verificationBadges).some((item) => badgeFromToken(item) === "documental");

  if (!badges.has("vida_laboral") && isDocumentaryOfficialVerification(args)) {
    badges.set("vida_laboral", makeBadge("vida_laboral"));
  }

  if (
    hasDocumentarySignal &&
    !badges.has("vida_laboral") &&
    !badges.has("contrato") &&
    !badges.has("nomina") &&
    !badges.has("certificado_empresa")
  ) {
    badges.set("documental", makeBadge("documental"));
  }

  if (hasVerifiedCompanySignal(args) || toArray(args.verificationBadges).some((item) => badgeFromToken(item) === "empresa")) {
    badges.set("empresa", makeBadge("empresa", hasVerifiedCompanySignal(args) ? "company" : "legacy"));
  }

  if (norm(args.verificationChannel) === "peer" || toArray(args.verificationBadges).some((item) => badgeFromToken(item) === "peer")) {
    badges.set("peer", makeBadge("peer", norm(args.verificationChannel) === "peer" ? "peer" : "legacy"));
  }

  return Array.from(badges.values()).sort((a, b) => b.priority - a.priority || a.label.localeCompare(b.label, "es"));
}

export function getExperienceVerificationBadgeClasses(tone: ExperienceVerificationBadge["tone"], emphasis: "primary" | "secondary" = "secondary") {
  if (tone === "documentary_strong") {
    return emphasis === "primary"
      ? "border-emerald-300 bg-emerald-100 text-emerald-900"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (tone === "documentary") {
    return emphasis === "primary"
      ? "border-sky-300 bg-sky-100 text-sky-900"
      : "border-sky-200 bg-sky-50 text-sky-800";
  }
  if (tone === "company") {
    return emphasis === "primary"
      ? "border-blue-300 bg-blue-100 text-blue-900"
      : "border-blue-200 bg-blue-50 text-blue-800";
  }
  return emphasis === "primary"
    ? "border-violet-300 bg-violet-100 text-violet-900"
    : "border-violet-200 bg-violet-50 text-violet-800";
}

export function toExperienceVerificationBadgeLabels(args: ResolveArgs) {
  return resolveExperienceVerificationBadges(args).map((badge) => badge.label);
}
