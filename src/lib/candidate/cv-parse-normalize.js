export function normalizeCvLanguages(rawLanguages, max = 30) {
  return (Array.isArray(rawLanguages) ? rawLanguages : [])
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .slice(0, max);
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
