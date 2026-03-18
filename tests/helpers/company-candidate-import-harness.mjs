import { randomBytes } from "crypto";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toNullable(value) {
  const text = normalizeText(value);
  return text || null;
}

function collapseSpaces(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function sanitizeCandidateText(value) {
  return collapseSpaces(String(value || "").replace(/[\u0000-\u001f\u007f]+/g, " "));
}

function looksLikeBinaryPdfContent(value) {
  const text = sanitizeCandidateText(value).toLowerCase();
  if (!text) return false;
  return text.startsWith("%pdf-") || text.includes("endobj") || text.includes("xref") || text.includes("catalog pages");
}

function isReliableCandidateName(value) {
  const text = sanitizeCandidateText(value);
  if (!text) return false;
  if (looksLikeBinaryPdfContent(text)) return false;
  if (text.includes("@")) return false;
  if (/\.pdf$|\.docx?$|^cv\b/i.test(text)) return false;
  if (/[<>%{}[\]\\]/.test(text)) return false;
  const letters = (text.match(/\p{L}/gu) || []).length;
  const digits = (text.match(/\d/g) || []).length;
  if (letters < 2 || digits > 2) return false;
  return true;
}

export function resolveSafeCandidateName(value, email) {
  const text = sanitizeCandidateText(value);
  if (isReliableCandidateName(text)) return text;
  const fallbackEmail = sanitizeCandidateText(email);
  if (fallbackEmail && fallbackEmail.includes("@")) return fallbackEmail;
  return "Candidato";
}

function normalizedBase(value) {
  return collapseSpaces(String(value || "").toLowerCase()).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const COMPANY_SUFFIXES = new Set([
  "sl",
  "s.l",
  "s l",
  "sa",
  "s.a",
  "s a",
  "slu",
  "s.l.u",
  "spain",
  "espana",
  "españa",
  "sociedad limitada",
  "sociedad anonima",
]);

function normalizeCompanyOrInstitution(value) {
  const base = normalizedBase(value).replace(/[.,;:()]+/g, " ");
  const parts = collapseSpaces(base).split(" ").filter(Boolean);
  while (parts.length > 0 && COMPANY_SUFFIXES.has(parts[parts.length - 1])) parts.pop();
  return parts.join(" ");
}

function normalizeRoleOrTitle(value) {
  return collapseSpaces(normalizedBase(value).replace(/[.,;:()]+/g, " "));
}

function normalizeDateForDb(value) {
  const text = normalizeText(value).toLowerCase();
  if (!text) return null;
  if (text.includes("actual") || text.includes("present")) return null;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ym = text.match(/^(\d{4})-(\d{2})$/);
  if (ym) return `${ym[1]}-${ym[2]}-01`;
  const y = text.match(/^(\d{4})$/);
  if (y) return `${y[1]}-01-01`;
  return null;
}

function normalizeMonth(value) {
  const text = normalizeText(value);
  if (!text) return "";
  const ym = text.match(/^(\d{4})-(\d{2})/);
  if (ym) return `${ym[1]}-${ym[2]}`;
  const y = text.match(/^(\d{4})$/);
  if (y) return `${y[1]}-01`;
  return text.toLowerCase();
}

function expExactSig(row) {
  return `${normalizeRoleOrTitle(row?.role_title || row?.title)}|${normalizeCompanyOrInstitution(row?.company_name || row?.company)}|${normalizeMonth(row?.start_date)}|${normalizeMonth(row?.end_date)}`;
}

function expPossibleSig(row) {
  return `${normalizeRoleOrTitle(row?.role_title || row?.title)}|${normalizeCompanyOrInstitution(row?.company_name || row?.company)}`;
}

function tokenizeText(value) {
  return normalizedBase(value)
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(" ")
    .map((item) => item.trim())
    .filter(Boolean);
}

function jaccardSimilarity(leftValue, rightValue) {
  const left = new Set(tokenizeText(leftValue));
  const right = new Set(tokenizeText(rightValue));
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  return intersection / (left.size + right.size - intersection);
}

function normalizeExtractedExperience(item) {
  return {
    company_name: toNullable(item?.company_name),
    role_title: toNullable(item?.role_title),
    start_date: normalizeDateForDb(item?.start_date),
    end_date: normalizeDateForDb(item?.end_date),
    location: toNullable(item?.location),
    description: toNullable(item?.description),
    skills: Array.isArray(item?.skills) ? item.skills.map((x) => String(x || "").trim()).filter(Boolean) : [],
  };
}

export function classifyExperienceSuggestion({ extracted, existingRows, inviteId, index }) {
  const normalized = normalizeExtractedExperience(extracted);
  const sameCompanyRole = existingRows.filter((row) => {
    return (
      normalizeCompanyOrInstitution(row?.company_name) === normalizeCompanyOrInstitution(normalized.company_name) &&
      normalizeRoleOrTitle(row?.role_title) === normalizeRoleOrTitle(normalized.role_title)
    );
  });

  const exactMatch = sameCompanyRole.find((row) => expExactSig(row) === expExactSig(normalized));
  if (exactMatch) {
    return {
      id: `${inviteId}:exp:${index}`,
      kind: "duplicate",
      status: "pending",
      reason: "Ya existe una experiencia sustancialmente igual en el perfil.",
      extracted_experience: normalized,
      matched_existing: {
        id: exactMatch?.id ? String(exactMatch.id) : null,
        company_name: toNullable(exactMatch?.company_name),
        role_title: toNullable(exactMatch?.role_title),
        start_date: normalizeDateForDb(exactMatch?.start_date),
        end_date: normalizeDateForDb(exactMatch?.end_date),
        description: toNullable(exactMatch?.description),
      },
    };
  }

  const updateMatch = sameCompanyRole.find((row) => {
    const startMonthMatches = normalizeMonth(row?.start_date) && normalizeMonth(row?.start_date) === normalizeMonth(normalized.start_date);
    const endMonthMatches = normalizeMonth(row?.end_date) && normalizeMonth(row?.end_date) === normalizeMonth(normalized.end_date);
    const similarity = jaccardSimilarity(row?.description, normalized.description);
    return startMonthMatches || endMonthMatches || similarity >= 0.45;
  });

  if (updateMatch) {
    return {
      id: `${inviteId}:exp:${index}`,
      kind: "update",
      status: "pending",
      reason: "Parece una experiencia existente con información nueva o más completa.",
      extracted_experience: normalized,
      matched_existing: {
        id: updateMatch?.id ? String(updateMatch.id) : null,
        company_name: toNullable(updateMatch?.company_name),
        role_title: toNullable(updateMatch?.role_title),
        start_date: normalizeDateForDb(updateMatch?.start_date),
        end_date: normalizeDateForDb(updateMatch?.end_date),
        description: toNullable(updateMatch?.description),
      },
    };
  }

  return {
    id: `${inviteId}:exp:${index}`,
    kind: "new",
    status: "pending",
    reason: "No existe una experiencia equivalente en el perfil actual.",
    extracted_experience: normalized,
    matched_existing: null,
  };
}

export function ensureCandidatePublicToken(existingToken) {
  const clean = normalizeText(existingToken);
  if (/^[a-f0-9]{48}$/i.test(clean)) return clean;
  return randomBytes(24).toString("hex");
}

export function simulateInviteCreation({ candidateEmail, existingCandidate }) {
  const candidateExists = Boolean(existingCandidate?.id);
  return {
    candidate_email: candidateEmail,
    linked_user_id: candidateExists ? existingCandidate.id : null,
    candidate_already_exists: candidateExists,
    candidate_public_token: candidateExists ? ensureCandidatePublicToken(existingCandidate.public_token) : null,
    status: "emailed",
  };
}

export function simulatePersistImportedCandidateProfile({
  mode,
  inviteId,
  companyName,
  candidateEmail,
  extracted,
  existingProfile = {},
  existingExperiences = [],
  rawCvJson = {},
}) {
  const safeMode = mode === "existing_candidate" ? "existing_candidate" : "new_candidate";
  const experienceRows = Array.isArray(extracted?.experiences) ? extracted.experiences : [];
  const suggestions = experienceRows.map((row, index) =>
    classifyExperienceSuggestion({
      extracted: row,
      existingRows: existingExperiences,
      inviteId,
      index,
    })
  );
  const currentLanguages = Array.isArray(existingProfile.languages) ? existingProfile.languages.map((item) => String(item || "").trim()).filter(Boolean) : [];
  const importedLanguages = Array.isArray(extracted?.languages)
    ? extracted.languages.map((item) => String(item?.name || item?.language || item || "").trim()).filter(Boolean)
    : [];
  const mergedLanguages = Array.from(new Set([...currentLanguages, ...importedLanguages]));
  const newLanguages = mergedLanguages.filter((item) => !currentLanguages.some((current) => current.toLowerCase() === item.toLowerCase()));
  const existingValidName = isReliableCandidateName(existingProfile.full_name) ? sanitizeCandidateText(existingProfile.full_name) : null;
  const importedValidName = isReliableCandidateName(extracted?.full_name) ? sanitizeCandidateText(extracted.full_name) : null;

  const nextRawCvJson = {
    ...(rawCvJson || {}),
    company_cv_import: {
      invite_id: inviteId,
      imported_at: "2026-03-13T10:00:00.000Z",
      mode: safeMode,
      extracted_payload: extracted,
      staged_only: true,
      profile_proposal: {
        full_name: existingValidName || importedValidName || null,
        full_name_source: existingValidName ? "existing_profile" : importedValidName ? "imported_cv" : "fallback",
        merged_languages: mergedLanguages,
        new_languages: newLanguages,
      },
    },
    company_cv_import_updates: [
      {
        invite_id: inviteId,
        company_name: companyName,
        imported_at: "2026-03-13T10:00:00.000Z",
        mode: safeMode,
        candidate_identity: {
          email: candidateEmail,
          display_name: resolveSafeCandidateName(extracted?.full_name, candidateEmail),
          reliable_name: importedValidName,
          existing_candidate: safeMode === "existing_candidate",
        },
        profile_proposal: {
          full_name: existingValidName || importedValidName || null,
          full_name_source: existingValidName ? "existing_profile" : importedValidName ? "imported_cv" : "fallback",
          merged_languages: mergedLanguages,
          new_languages: newLanguages,
        },
        experience_suggestions: suggestions,
      },
    ],
  };

  return {
    mode: safeMode,
    candidate_email: candidateEmail,
    profile_patch: {
      full_name: existingValidName || null,
      title: existingProfile.title || null,
      email: existingProfile.email || candidateEmail || null,
    },
    inserted_experiences: [],
    suggestions,
    raw_cv_json: nextRawCvJson,
  };
}

export function simulateAcceptancePersistence({ inviteId, companyId, candidateEmail, acceptedByUserId }) {
  return {
    invite_id: inviteId,
    company_id: companyId,
    candidate_email: candidateEmail,
    accepted_by_user_id: acceptedByUserId,
    source_flow: "company_cv_import",
    legal_text_version: "company_cv_import_v1_2026_03_13",
    accepted_at: "2026-03-13T11:00:00.000Z",
    accepted_ip: "127.0.0.1",
    accepted_user_agent: "node-test-harness",
  };
}
