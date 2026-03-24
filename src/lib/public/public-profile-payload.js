function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function sanitizePublicCandidatePayload(payload, { internalPreviewAllowed = false } = {}) {
  const next = clone(payload) || {};

  if (internalPreviewAllowed) return next;

  delete next.candidate_id;

  if (next?.candidate_public_profile?.identity) {
    delete next.candidate_public_profile.identity.candidate_id;
  }

  if (next?.candidate_public_profile) {
    next.candidate_public_profile.location = next?.teaser?.location || next.candidate_public_profile.location || null;
  }

  return next;
}

export function containsSensitivePublicKeys(value) {
  const sensitiveKeys = new Set(["candidate_id", "user_id", "company_id", "storage_path"]);

  function walk(input) {
    if (Array.isArray(input)) return input.some(walk);
    if (!input || typeof input !== "object") return false;

    for (const [key, nested] of Object.entries(input)) {
      if (sensitiveKeys.has(String(key || "").toLowerCase())) return true;
      if (walk(nested)) return true;
    }

    return false;
  }

  return walk(value);
}
