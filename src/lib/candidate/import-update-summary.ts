function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asObject(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, any>) : {};
}

function asText(value: unknown) {
  return String(value || "").trim();
}

export type CompanyCvImportSummary = {
  importedFromCompanyCv: boolean;
  updatesCount: number;
  pendingEntries: number;
  pendingExperienceSuggestions: number;
  pendingLanguageProposals: number;
  pendingProfileProposals: number;
  totalPendingItems: number;
};

export function summarizeCompanyCvImportUpdates(rawCvJson: unknown): CompanyCvImportSummary {
  const raw = asObject(rawCvJson);
  const updates = asArray(raw.company_cv_import_updates);

  let pendingEntries = 0;
  let pendingExperienceSuggestions = 0;
  let pendingLanguageProposals = 0;
  let pendingProfileProposals = 0;

  for (const entry of updates) {
    const item = asObject(entry);
    const suggestions = asArray(item.experience_suggestions);
    const pendingSuggestions = suggestions.filter((suggestion) => {
      const row = asObject(suggestion);
      return asText(row.status || "pending").toLowerCase() === "pending" &&
        asText(row.kind).toLowerCase() !== "duplicate";
    }).length;

    const proposal = asObject(item.profile_proposal);
    const hasPendingLanguages =
      asArray(proposal.merged_languages).length > 0 &&
      !asText(proposal.languages_applied_at);
    const hasPendingProfileProposal =
      Boolean(asText(proposal.full_name)) ||
      Boolean(asText(proposal.headline)) ||
      Boolean(asText(proposal.location)) ||
      Boolean(asText(proposal.summary));

    if (pendingSuggestions > 0 || hasPendingLanguages || hasPendingProfileProposal) {
      pendingEntries += 1;
    }

    pendingExperienceSuggestions += pendingSuggestions;
    if (hasPendingLanguages) pendingLanguageProposals += 1;
    if (hasPendingProfileProposal) pendingProfileProposals += 1;
  }

  return {
    importedFromCompanyCv: Boolean(raw.company_cv_import),
    updatesCount: updates.length,
    pendingEntries,
    pendingExperienceSuggestions,
    pendingLanguageProposals,
    pendingProfileProposals,
    totalPendingItems: pendingExperienceSuggestions + pendingLanguageProposals + pendingProfileProposals,
  };
}
