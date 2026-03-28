type AnyRecord = Record<string, any>;

const BLOCKED_DISPLAY_NAMES = new Set([
  "candidato",
  "candidato verificado",
  "candidata",
  "candidata verificada",
  "persona candidata",
]);

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" ? (value as AnyRecord) : {};
}

function getNested(source: AnyRecord, path: string): any {
  return path.split(".").reduce((acc: any, key) => acc?.[key], source);
}

export function pickFirstMeaningfulString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (BLOCKED_DISPLAY_NAMES.has(trimmed.toLowerCase())) continue;
    return trimmed;
  }
  return null;
}

function joinNameParts(...parts: unknown[]) {
  const value = parts
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim())
    .join(" ")
    .trim();

  return pickFirstMeaningfulString(value);
}

export function resolvePublicCandidateDisplayName(source: unknown): string {
  const root = asRecord(source);

  return (
    pickFirstMeaningfulString(
      root?.full_name,
      getNested(root, "teaser.full_name"),
      getNested(root, "candidate_public_profile.identity.full_name"),
      root?.public_name,
      getNested(root, "teaser.public_name"),
      getNested(root, "candidate_public_profile.identity.public_name"),
      joinNameParts(root?.first_name, root?.last_name),
      joinNameParts(getNested(root, "candidate_profile.first_name"), getNested(root, "candidate_profile.last_name")),
      joinNameParts(getNested(root, "profile.first_name"), getNested(root, "profile.last_name")),
      root?.name,
      root?.display_name,
      root?.candidate_name,
      getNested(root, "candidate_profile.full_name"),
      getNested(root, "candidate_profile.name"),
      getNested(root, "profile.full_name"),
      getNested(root, "profile.name"),
      getNested(root, "profile.display_name"),
    ) || "Perfil verificable"
  );
}

export function getInitialsFromDisplayName(name: string): string {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) return "PV";
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function pickFirstArray(...values: unknown[]): any[] {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

function toStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
}

function toNonNegativeNumber(...values: unknown[]): number {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return 0;
}

export type PublicProfileDisplaySummary = {
  educationCount: number;
  languages: string[];
  skills: string[];
  achievements: string[];
  achievementsCount: number;
  visibleCapabilitiesCount: number;
  educationLabel: string;
  languagesLabel: string;
  capabilitiesLabel: string;
};

export function resolvePublicProfileDisplaySummary(source: unknown): PublicProfileDisplaySummary {
  const root = asRecord(source);
  const education = pickFirstArray(
    root?.education,
    getNested(root, "candidate_public_profile.education"),
  );
  const languages = toStringArray(
    pickFirstArray(
      root?.languages,
      root?.teaser?.languages,
      getNested(root, "candidate_public_profile.languages"),
    ),
  );
  const skills = toStringArray(
    pickFirstArray(
      root?.verified_skills,
      root?.skills,
      getNested(root, "candidate_public_profile.skills"),
    ),
  );
  const achievements = toStringArray(root?.achievements);
  const educationCount = toNonNegativeNumber(root?.education_total, root?.teaser?.education_total, education.length);
  const achievementsCount = toNonNegativeNumber(root?.achievements_total, root?.teaser?.achievements_total, achievements.length);
  const visibleCapabilitiesCount = skills.length + achievementsCount;

  const educationLabel =
    educationCount > 0
      ? `${educationCount} ${educationCount === 1 ? "formacion" : "formaciones"}`
      : "Formacion pendiente";
  const languagesLabel = languages.length > 0 ? languages.slice(0, 2).join(", ") : "Idiomas no añadidos";

  let capabilitiesLabel = "Habilidades aun no visibles";
  if (skills.length > 0 && achievementsCount > 0) {
    capabilitiesLabel = `${skills.length} habilidades · ${achievementsCount} logros`;
  } else if (skills.length > 0) {
    capabilitiesLabel = `${skills.length} ${skills.length === 1 ? "habilidad visible" : "habilidades visibles"}`;
  } else if (achievementsCount > 0) {
    capabilitiesLabel = `${achievementsCount} ${achievementsCount === 1 ? "logro visible" : "logros visibles"}`;
  }

  return {
    educationCount,
    languages,
    skills,
    achievements,
    achievementsCount,
    visibleCapabilitiesCount,
    educationLabel,
    languagesLabel,
    capabilitiesLabel,
  };
}
