export type CandidatePublicLinkResolveResult =
  | {
      ok: true;
      token: string;
      link: {
        id: string;
        candidate_id: string;
        expires_at: string | null;
        is_active?: boolean | null;
      };
    }
  | {
      ok: false;
      reason: "invalid_token" | "not_found" | "expired" | "db_error";
      details?: string | null;
    };

export function normalizeCandidatePublicToken(raw: unknown) {
  const base = String(raw || "").trim();
  if (!base) return "";
  const decoded = (() => {
    try {
      return decodeURIComponent(base).trim();
    } catch {
      return base;
    }
  })();

  const extractFromPath = (input: string) => {
    const cleaned = input.split("?")[0]?.split("#")[0] || "";
    const parts = cleaned.split("/").filter(Boolean);
    if (!parts.length) return "";
    const pIndex = parts.findIndex((part) => part === "p");
    if (pIndex >= 0 && parts[pIndex + 1]) return parts[pIndex + 1];
    const publicCandidateIndex = parts.findIndex((part) => part === "public-candidate");
    if (publicCandidateIndex >= 0 && parts[publicCandidateIndex + 1]) return parts[publicCandidateIndex + 1];
    const companyCandidateIndex = parts.findIndex((part, index) => part === "candidate" && parts[index - 1] === "company");
    if (companyCandidateIndex >= 0 && parts[companyCandidateIndex + 1]) return parts[companyCandidateIndex + 1];
    return "";
  };

  if (/^https?:\/\//i.test(decoded)) {
    try {
      const url = new URL(decoded);
      const extracted = extractFromPath(url.pathname);
      if (extracted) return extracted;
    } catch {
      const extracted = extractFromPath(decoded.replace(/^https?:\/\//i, ""));
      if (extracted) return extracted;
    }
  }

  const extracted = extractFromPath(decoded);
  if (extracted) return extracted;
  return decoded;
}

export function isCandidatePublicTokenFormat(token: string) {
  // Soporta tokens históricos válidos (hex, uuid y variantes URL-safe).
  return /^[A-Za-z0-9_-]{16,128}$/.test(token);
}

export function isCandidatePublicTokenExpired(expiresAt?: string | null) {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return false;
  return t <= Date.now();
}

export async function resolveActiveCandidatePublicLink(admin: any, rawToken: unknown): Promise<CandidatePublicLinkResolveResult> {
  const token = normalizeCandidatePublicToken(rawToken);
  if (!token || !isCandidatePublicTokenFormat(token)) {
    return { ok: false, reason: "invalid_token" };
  }

  const { data, error } = await admin
    .from("candidate_public_links")
    .select("id,candidate_id,expires_at,is_active,created_at")
    .eq("public_token", token)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    return { ok: false, reason: "db_error", details: error.message };
  }

  const row = Array.isArray(data) && data.length ? data[0] : null;
  if (!row?.id || !row?.candidate_id) {
    return { ok: false, reason: "not_found" };
  }

  if (isCandidatePublicTokenExpired(row.expires_at)) {
    return { ok: false, reason: "expired" };
  }

  return {
    ok: true,
    token,
    link: {
      id: String(row.id),
      candidate_id: String(row.candidate_id),
      expires_at: row.expires_at || null,
      is_active: row.is_active ?? null,
    },
  };
}
