export function inferExperienceFromFilename(filename, options) {
  const normalized = String(filename || "").toLowerCase();
  return (Array.isArray(options) ? options : []).find((opt) => {
    const label = String(opt?.label || "").toLowerCase();
    const [position = "", company = ""] = label.split("—").map((x) => x.trim());
    const companyToken = company.split(" ").filter((x) => x.length > 2)[0] || "";
    const positionToken = position.split(" ").filter((x) => x.length > 2)[0] || "";
    return (companyToken && normalized.includes(companyToken)) || (positionToken && normalized.includes(positionToken));
  })?.id;
}

export function resolveEvidenceEmploymentRecordId({ filename, options, selectedExperienceId }) {
  const guessedId = inferExperienceFromFilename(filename, options);
  return {
    guessedId: guessedId || null,
    employmentRecordId: guessedId || String(selectedExperienceId || ""),
  };
}
