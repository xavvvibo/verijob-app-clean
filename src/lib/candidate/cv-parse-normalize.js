function extractCvLanguageName(item) {
  if (typeof item === "string") return item.trim();
  if (item && typeof item === "object") {
    return String(item.name || item.language || item.title || "").trim();
  }
  return String(item || "").trim();
}

const LANGUAGE_ALIASES = new Map([
  ["espanol", "Español"],
  ["español", "Español"],
  ["castellano", "Español"],
  ["catalan", "Catalán"],
  ["català", "Catalán"],
  ["catalán", "Catalán"],
  ["ingles", "Inglés"],
  ["inglés", "Inglés"],
  ["english", "Inglés"],
  ["frances", "Francés"],
  ["francés", "Francés"],
  ["french", "Francés"],
  ["aleman", "Alemán"],
  ["alemán", "Alemán"],
  ["german", "Alemán"],
  ["italiano", "Italiano"],
  ["italian", "Italiano"],
  ["portugues", "Portugués"],
  ["portugués", "Portugués"],
  ["portuguese", "Portugués"],
  ["valenciano", "Valenciano"],
  ["euskera", "Euskera"],
  ["vasco", "Euskera"],
  ["gallego", "Gallego"],
  ["neerlandes", "Neerlandés"],
  ["neerlandés", "Neerlandés"],
  ["dutch", "Neerlandés"],
  ["rumano", "Rumano"],
  ["romanian", "Rumano"],
  ["arabe", "Árabe"],
  ["árabe", "Árabe"],
  ["arabic", "Árabe"],
]);

function collapseSpaces(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeLanguageCandidate(value) {
  return collapseSpaces(value)
    .replace(/\b(nativo|nativa|bilingue|bilingüe|fluido|fluida|avanzado|avanzada|intermedio|intermedia|basico|básico|basica|básica|medio|alto|alta)\b/gi, " ")
    .replace(/\b(a1|a2|b1|b2|c1|c2)\b/gi, " ")
    .replace(/[()[\]{}:/.|,;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalizeLanguage(value) {
  const raw = normalizeLanguageCandidate(value);
  if (!raw) return "";
  const lower = raw.toLowerCase();
  if (LANGUAGE_ALIASES.has(lower)) return LANGUAGE_ALIASES.get(lower);
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function looksLikeSectionHeader(line) {
  return /^(experiencia|experience|formacion|formación|education|skills|habilidades|perfil|summary|resumen|contacto|contact|datos|projects?|proyectos)\b/i.test(
    collapseSpaces(line).toLowerCase()
  );
}

export function extractCvLanguagesFromText(rawText, max = 12) {
  const text = String(rawText || "");
  if (!text.trim()) return [];

  const lines = text
    .split(/\r?\n/)
    .map((line) => collapseSpaces(line))
    .filter(Boolean);

  const collected = [];
  let insideLanguagesBlock = false;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/^(idiomas?|languages?|language skills?)\b/.test(lower)) {
      insideLanguagesBlock = true;
      const inline = line.replace(/^(idiomas?|languages?|language skills?)\s*:?\s*/i, "");
      if (inline) collected.push(...inline.split(/[·,;]+/g));
      continue;
    }

    if (insideLanguagesBlock) {
      if (looksLikeSectionHeader(line)) break;
      collected.push(...line.split(/[·,;]+/g));
      continue;
    }

    if (LANGUAGE_ALIASES.size > 0) {
      for (const [alias, canonical] of LANGUAGE_ALIASES.entries()) {
        if (new RegExp(`(^|[^\\p{L}])${alias}([^\\p{L}]|$)`, "iu").test(lower)) {
          collected.push(canonical);
        }
      }
    }
  }

  return normalizeCvLanguages(collected, max);
}

export function normalizeCvLanguages(rawLanguages, max = 30, fallbackText = "") {
  const seen = new Set();
  const out = [];

  for (const item of Array.isArray(rawLanguages) ? rawLanguages : []) {
    const language = canonicalizeLanguage(extractCvLanguageName(item));
    const key = language.toLowerCase();
    if (!language || seen.has(key)) continue;
    seen.add(key);
    out.push(language);
    if (out.length >= max) break;
  }

  if (out.length === 0 && fallbackText) {
    for (const language of extractCvLanguagesFromText(fallbackText, max)) {
      const key = language.toLowerCase();
      if (!language || seen.has(key)) continue;
      seen.add(key);
      out.push(language);
      if (out.length >= max) break;
    }
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
