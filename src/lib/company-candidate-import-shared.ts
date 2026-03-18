function collapseSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function sanitizeCandidateText(value: unknown) {
  return collapseSpaces(
    String(value || "")
      .replace(/[\u0000-\u001f\u007f]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function titleCaseEmailLocalPart(email: string) {
  return sanitizeCandidateText(email.split("@")[0] || "")
    .split(/[._-]+/)
    .map((part) => (part ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : ""))
    .filter(Boolean)
    .join(" ");
}

export function looksLikeBinaryPdfContent(value: unknown) {
  const text = sanitizeCandidateText(value).toLowerCase();
  if (!text) return false;
  return (
    text.startsWith("%pdf-") ||
    text.includes("endobj") ||
    text.includes("xref") ||
    text.includes("stream endstream") ||
    text.includes("catalog pages")
  );
}

export function isReliableCandidateName(value: unknown) {
  const text = sanitizeCandidateText(value);
  if (!text) return false;
  if (looksLikeBinaryPdfContent(text)) return false;
  if (text.includes("@")) return false;
  if (/\.pdf$|\.docx?$|^cv\b/i.test(text)) return false;
  if (/[<>%{}[\]\\]/.test(text)) return false;
  if (text.length < 2 || text.length > 120) return false;
  const letters = (text.match(/\p{L}/gu) || []).length;
  const digits = (text.match(/\d/g) || []).length;
  if (letters < 2) return false;
  if (digits > 2) return false;
  return true;
}

export function resolveSafeCandidateName(value: unknown, email?: unknown) {
  const candidateName = sanitizeCandidateText(value);
  if (isReliableCandidateName(candidateName)) return candidateName;

  const fallbackEmail = sanitizeCandidateText(email);
  if (fallbackEmail && fallbackEmail.includes("@")) return fallbackEmail;

  const emailLocal = titleCaseEmailLocalPart(String(email || ""));
  if (emailLocal) return emailLocal;

  return "Candidato";
}
