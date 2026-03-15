export type CompanyDocumentVerificationStatus = "none" | "uploaded" | "under_review" | "verified" | "rejected";

export type CompanyDocumentRow = {
  id?: string | null;
  document_type?: string | null;
  review_status?: string | null;
  rejected_reason?: string | null;
  review_notes?: string | null;
  reviewed_at?: string | null;
  lifecycle_status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  extracted_json?: Record<string, any> | null;
};

type CompanyProfileSignals = {
  tax_id?: string | null;
  legal_name?: string | null;
  trade_name?: string | null;
  contact_email?: string | null;
  website_url?: string | null;
};

function asText(value: unknown) {
  return String(value || "").trim();
}

function normalizeTaxId(value: unknown) {
  return asText(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeName(value: unknown) {
  return asText(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeDomain(value: unknown) {
  const raw = asText(value).toLowerCase();
  if (!raw) return "";
  const candidate = raw.includes("@") ? raw.split("@")[1] || "" : raw;
  try {
    const url = candidate.startsWith("http://") || candidate.startsWith("https://") ? new URL(candidate) : new URL(`https://${candidate}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return candidate.replace(/^www\./, "");
  }
}

function toIso(value: unknown) {
  const raw = asText(value);
  if (!raw) return null;
  const ts = Date.parse(raw);
  return Number.isFinite(ts) ? new Date(ts).toISOString() : null;
}

export function normalizeCompanyDocumentReviewStatus(value: unknown) {
  const raw = asText(value).toLowerCase();
  if (raw === "approved") return "approved";
  if (raw === "rejected") return "rejected";
  if (raw === "uploaded") return "uploaded";
  return "pending_review";
}

export function resolveCompanyDocumentReviewPriority(planRaw: unknown) {
  const plan = asText(planRaw).toLowerCase();
  if (plan.includes("company_team")) {
    return { tier: "team", label: "Prioridad máxima", etaHours: 4, etaLabel: "aprox. 4 horas" };
  }
  if (plan.includes("company_hiring")) {
    return { tier: "hiring", label: "Prioridad alta", etaHours: 8, etaLabel: "aprox. 8 horas" };
  }
  if (plan.includes("company_access")) {
    return { tier: "access", label: "Prioridad estándar", etaHours: 24, etaLabel: "aprox. 24 horas" };
  }
  return { tier: "free", label: "Cola estándar", etaHours: 72, etaLabel: "hasta 72 horas" };
}

function reviewEtaAt(createdAt: unknown, etaHours: number) {
  const iso = toIso(createdAt);
  if (!iso) return null;
  return new Date(Date.parse(iso) + etaHours * 60 * 60 * 1000).toISOString();
}

function computeAutoReviewDecision(doc: CompanyDocumentRow, profile: CompanyProfileSignals) {
  const extracted = doc?.extracted_json && typeof doc.extracted_json === "object"
    ? ((doc.extracted_json as any).detected || {})
    : {};
  const detectedFieldsCount = Number((doc?.extracted_json as any)?.detected_fields_count || 0);

  const extractedTaxId = normalizeTaxId((extracted as any)?.tax_id);
  const profileTaxId = normalizeTaxId(profile.tax_id);
  const extractedLegalName = normalizeName((extracted as any)?.legal_name || (extracted as any)?.trade_name);
  const profileLegalName = normalizeName(profile.legal_name || profile.trade_name);
  const extractedDomain = normalizeDomain((extracted as any)?.contact_email);
  const profileDomain = normalizeDomain(profile.contact_email || profile.website_url);

  let positiveSignals = 0;
  let negativeSignals = 0;

  if (extractedTaxId && profileTaxId) {
    if (extractedTaxId === profileTaxId) positiveSignals += 2;
    else negativeSignals += 2;
  }

  if (extractedLegalName && profileLegalName) {
    if (extractedLegalName === profileLegalName || extractedLegalName.includes(profileLegalName) || profileLegalName.includes(extractedLegalName)) {
      positiveSignals += 1;
    } else {
      negativeSignals += 1;
    }
  }

  if (extractedDomain && profileDomain) {
    if (extractedDomain === profileDomain) positiveSignals += 1;
    else negativeSignals += 1;
  }

  if (negativeSignals > 0) {
    return {
      review_status: "rejected" as const,
      rejected_reason: "Los datos detectados en el documento no coinciden con la ficha actual de la empresa.",
      review_notes: "Se requiere una nueva versión del documento o revisar antes los datos del perfil empresa.",
    };
  }

  if (positiveSignals > 0 || detectedFieldsCount >= 3) {
    return {
      review_status: "approved" as const,
      rejected_reason: null,
      review_notes: "Revisión documental completada. El documento aporta señales suficientes para validar la empresa.",
    };
  }

  return {
    review_status: "rejected" as const,
    rejected_reason: "No hemos podido confirmar suficientes datos de empresa con el documento recibido.",
    review_notes: "Sube una versión más legible o un documento oficial adicional para continuar la revisión.",
  };
}

export async function finalizeCompanyDocumentsIfDue(args: {
  admin: any;
  docs: CompanyDocumentRow[];
  companyProfile: CompanyProfileSignals;
  planRaw: unknown;
}) {
  const priority = resolveCompanyDocumentReviewPriority(args.planRaw);
  const out = [...(Array.isArray(args.docs) ? args.docs : [])];
  const now = Date.now();

  for (let i = 0; i < out.length; i += 1) {
    const doc = out[i];
    if (asText(doc?.lifecycle_status || "active").toLowerCase() === "deleted") continue;
    const reviewStatus = normalizeCompanyDocumentReviewStatus(doc?.review_status);
    if (reviewStatus === "approved" || reviewStatus === "rejected") continue;
    const etaAt = reviewEtaAt(doc?.created_at, priority.etaHours);
    if (!etaAt || Date.parse(etaAt) > now || !doc?.id) continue;

    const decision = computeAutoReviewDecision(doc, args.companyProfile);
    const reviewedAt = new Date(now).toISOString();
    const patch = {
      review_status: decision.review_status,
      status: decision.review_status,
      reviewed_at: reviewedAt,
      review_notes: decision.review_notes,
      rejected_reason: decision.rejected_reason,
      updated_at: reviewedAt,
    };

    const { data: updated, error } = await args.admin
      .from("company_verification_documents")
      .update(patch)
      .eq("id", doc.id)
      .select("id,document_type,review_status,rejected_reason,review_notes,reviewed_at,lifecycle_status,created_at,updated_at,extracted_json")
      .maybeSingle();

    if (!error && updated) {
      out[i] = {
        ...doc,
        ...updated,
      };
    }
  }

  return out;
}

export function deriveCompanyDocumentVerificationState(args: {
  docs: CompanyDocumentRow[];
  legacyHasDocument?: boolean;
  planRaw: unknown;
}) {
  const priority = resolveCompanyDocumentReviewPriority(args.planRaw);
  const activeDocs = (Array.isArray(args.docs) ? args.docs : []).filter(
    (doc) => asText(doc?.lifecycle_status || "active").toLowerCase() !== "deleted",
  );
  const latestDoc = activeDocs[0] || null;
  const latestPending = activeDocs.find((doc) => {
    const status = normalizeCompanyDocumentReviewStatus(doc.review_status);
    return status === "pending_review" || status === "uploaded";
  }) || null;
  const latestApproved = activeDocs.find((doc) => normalizeCompanyDocumentReviewStatus(doc.review_status) === "approved") || null;
  const latestRejected = activeDocs.find((doc) => normalizeCompanyDocumentReviewStatus(doc.review_status) === "rejected") || null;
  const latestSubmittedAt = toIso(latestDoc?.created_at);
  const latestReviewedAt = toIso((latestApproved || latestRejected)?.reviewed_at);
  const etaAt = latestPending ? reviewEtaAt(latestPending.created_at, priority.etaHours) : null;

  if (latestApproved) {
    return {
      status: "verified" as CompanyDocumentVerificationStatus,
      label: "Verificada documentalmente",
      detail: latestPending
        ? "Ya tienes documentación válida. El documento más reciente sigue en revisión."
        : "La documentación de empresa ya ha sido revisada y validada.",
      submitted_at: latestSubmittedAt,
      reviewed_at: latestReviewedAt,
      review_eta_at: etaAt,
      review_eta_label: priority.etaLabel,
      priority_label: priority.label,
      latest_document_type: latestDoc?.document_type || null,
      rejection_reason: null,
      has_document: true,
    };
  }

  if (latestRejected) {
    return {
      status: "rejected" as CompanyDocumentVerificationStatus,
      label: "Requiere corrección",
      detail: latestRejected.rejected_reason || latestRejected.review_notes || "Necesitamos un documento corregido o más legible para continuar la validación.",
      submitted_at: latestSubmittedAt,
      reviewed_at: latestReviewedAt,
      review_eta_at: null,
      review_eta_label: priority.etaLabel,
      priority_label: priority.label,
      latest_document_type: latestDoc?.document_type || null,
      rejection_reason: latestRejected.rejected_reason || latestRejected.review_notes || null,
      has_document: true,
    };
  }

  if (latestPending) {
    return {
      status: "under_review" as CompanyDocumentVerificationStatus,
      label: "En revisión",
      detail: "Documento recibido. Estamos revisándolo.",
      submitted_at: latestSubmittedAt,
      reviewed_at: null,
      review_eta_at: etaAt,
      review_eta_label: priority.etaLabel,
      priority_label: priority.label,
      latest_document_type: latestPending.document_type || null,
      rejection_reason: null,
      has_document: true,
    };
  }

  if (args.legacyHasDocument) {
    return {
      status: "uploaded" as CompanyDocumentVerificationStatus,
      label: "Documento recibido",
      detail: "Hay documentación registrada en el perfil y debe pasar por revisión antes de validar la empresa.",
      submitted_at: latestSubmittedAt,
      reviewed_at: null,
      review_eta_at: etaAt,
      review_eta_label: priority.etaLabel,
      priority_label: priority.label,
      latest_document_type: latestDoc?.document_type || null,
      rejection_reason: null,
      has_document: true,
    };
  }

  return {
    status: "none" as CompanyDocumentVerificationStatus,
    label: "Sin documento",
    detail: "Todavía no hay ningún documento oficial pendiente de revisión.",
    submitted_at: null,
    reviewed_at: null,
    review_eta_at: null,
    review_eta_label: priority.etaLabel,
    priority_label: priority.label,
    latest_document_type: null,
    rejection_reason: null,
    has_document: false,
  };
}
