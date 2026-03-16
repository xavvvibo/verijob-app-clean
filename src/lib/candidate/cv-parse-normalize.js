function extractCvLanguageName(item) {
  if (typeof item === "string") return item.trim();
  if (item && typeof item === "object") {
    return String(item.name || item.language || item.title || "").trim();
  }
  return String(item || "").trim();
}

export function normalizeCvLanguages(rawLanguages, max = 30) {
  const seen = new Set();
  const out = [];

  for (const item of Array.isArray(rawLanguages) ? rawLanguages : []) {
    const language = extractCvLanguageName(item);
    const key = language.toLowerCase();
    if (!language || seen.has(key)) continue;
    seen.add(key);
    out.push(language);
    if (out.length >= max) break;
  }

  return out;
}

export function shouldImportEducationRow(item) {
  const title = String(item?.title || item?.degree || "").trim();
  const institution = String(item?.institution || "").trim();
  const description = String(item?.description || item?.notes || "").trim();
  return Boolean(title || institution || description);
}

export function shouldApplyParsedResultOnce({ nextJobId, lastAppliedJobId }) {
  const nextId = String(nextJobId || "").trim();
  const lastId = String(lastAppliedJobId || "").trim();
  return Boolean(nextId) && nextId !== lastId;
}

export function selectLanguagesPersistenceTarget(profileColumns, candidateProfileColumns) {
  const profileSet = profileColumns instanceof Set ? profileColumns : new Set(profileColumns || []);
  const candidateSet =
    candidateProfileColumns instanceof Set ? candidateProfileColumns : new Set(candidateProfileColumns || []);
  if (profileSet.has("languages")) return "profiles.languages";
  if (candidateSet.has("achievements")) return "candidate_profiles.achievements";
  if (candidateSet.has("other_achievements")) return "candidate_profiles.other_achievements";
  return "skip";
}
