function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

const forbiddenPublicKeys = new Set(["candidate_id", "user_id", "company_id", "storage_path"]);

function stripForbiddenKeys(value) {
  if (Array.isArray(value)) {
    return value.map(stripForbiddenKeys);
  }

  if (!value || typeof value !== "object") return value;

  const output = {};

  for (const [key, nested] of Object.entries(value)) {
    if (forbiddenPublicKeys.has(String(key || "").toLowerCase())) continue;
    output[key] = stripForbiddenKeys(nested);
  }

  return output;
}

export function sanitizePublicCandidatePayload(payload, { internalPreviewAllowed = false } = {}) {
  const next = clone(payload) || {};

  if (internalPreviewAllowed) return next;

  const sanitized = stripForbiddenKeys(next);

  if (sanitized?.candidate_public_profile) {
    sanitized.candidate_public_profile.location =
      sanitized?.teaser?.location || sanitized.candidate_public_profile.location || null;
  }

  return sanitized;
}

export function containsSensitivePublicKeys(value) {
  function walk(input) {
    if (Array.isArray(input)) return input.some(walk);
    if (!input || typeof input !== "object") return false;

    for (const [key, nested] of Object.entries(input)) {
      if (forbiddenPublicKeys.has(String(key || "").toLowerCase())) return true;
      if (walk(nested)) return true;
    }

    return false;
  }

  return walk(value);
}
