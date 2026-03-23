export type MatchLevel = 'strong_match' | 'possible_match' | 'weak_or_mismatch';

export const calculateMatchScore = (profileExp: any, docRow: any): { level: MatchLevel; score: number } => {
  if (!profileExp || !docRow) return { level: 'weak_or_mismatch', score: 0 };
  
  const profileName = (profileExp.company || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const docName = docRow.normalizedName || "";

  const isNameMatch = profileName.includes(docName) || docName.includes(profileName);
  const profileYear = profileExp.start_date ? new Date(profileExp.start_date).getFullYear().toString() : "";
  const docYear = docRow.startDate ? docRow.startDate.split('/')[2] : "";
  const isDateCoherent = profileYear === docYear;

  if (isNameMatch && isDateCoherent) return { level: 'strong_match', score: 1.0 };
  if (isNameMatch || isDateCoherent) return { level: 'possible_match', score: 0.5 };
  return { level: 'weak_or_mismatch', score: 0.1 };
};
