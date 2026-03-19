const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
  "live.com",
  "msn.com",
  "aol.com",
])

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "yopmail.com",
  "10minutemail.com",
  "guerrillamail.com",
  "tempmail.com",
  "temp-mail.org",
  "trashmail.com",
  "getnada.com",
])

export type VerifierEmailClassification = "corporate" | "free" | "disposable" | "unknown"

function asText(value: unknown) {
  return String(value || "").trim()
}

export function normalizeEmailDomain(value: unknown) {
  const email = asText(value).toLowerCase()
  if (!email.includes("@")) return null
  const domain = email.split("@")[1]?.trim().replace(/^www\./, "") || ""
  return domain || null
}

export function normalizeHost(value: unknown) {
  const raw = asText(value).toLowerCase()
  if (!raw) return null
  try {
    const url = raw.startsWith("http://") || raw.startsWith("https://") ? new URL(raw) : new URL(`https://${raw}`)
    return url.hostname.replace(/^www\./, "") || null
  } catch {
    return null
  }
}

function normalizeCompanyTokens(value: unknown) {
  return asText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length >= 3)
}

function domainIncludesCompany(domain: string | null, companyName: string | null) {
  if (!domain || !companyName) return false
  const normalizedDomain = domain.replace(/\.[a-z]{2,}(\.[a-z]{2,})?$/i, "")
  const tokens = normalizeCompanyTokens(companyName)
  return tokens.some((token) => normalizedDomain.includes(token))
}

export function classifyVerifierEmail(args: {
  email?: unknown
  companyName?: unknown
  companyWebsiteUrl?: unknown
  companyContactEmail?: unknown
}) {
  const domain = normalizeEmailDomain(args.email)
  const websiteDomain = normalizeHost(args.companyWebsiteUrl)
  const contactDomain = normalizeEmailDomain(args.companyContactEmail)
  const reasons: string[] = []

  let classification: VerifierEmailClassification = "unknown"
  if (!domain) {
    reasons.push("invalid_email_domain")
  } else if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    classification = "disposable"
    reasons.push("disposable_domain")
  } else if (FREE_EMAIL_DOMAINS.has(domain)) {
    classification = "free"
    reasons.push("free_domain")
  } else {
    classification = "corporate"
  }

  const companyMatch =
    Boolean(domain && websiteDomain && domain === websiteDomain) ||
    Boolean(domain && contactDomain && domain === contactDomain) ||
    domainIncludesCompany(domain, asText(args.companyName) || null)

  if (classification === "corporate" && !companyMatch) {
    reasons.push("company_domain_mismatch")
  }

  const ownerAttentionRequired =
    classification === "disposable" ||
    classification === "unknown" ||
    (classification === "free") ||
    (classification === "corporate" && !companyMatch)

  return {
    email: asText(args.email).toLowerCase() || null,
    domain,
    classification,
    company_match: companyMatch,
    owner_attention_required: ownerAttentionRequired,
    reasons,
  }
}

export function verificationTrustWeightForSignal(signal: any) {
  const classification = String(signal?.classification || "unknown").toLowerCase()
  const companyMatch = Boolean(signal?.company_match)

  if (classification === "corporate" && companyMatch) return 1
  if (classification === "corporate") return 0.35
  if (classification === "free") return 0.15
  if (classification === "unknown") return 0.1
  if (classification === "disposable") return 0
  return 0
}

export async function resolveVerificationCompanyAssociation(args: {
  admin: any
  targetEmail?: unknown
  companyName?: unknown
}) {
  const targetEmail = asText(args.targetEmail).toLowerCase()
  const companyName = asText(args.companyName)
  const domain = normalizeEmailDomain(targetEmail)
  const exactMatches = new Map<string, string>()
  const domainMatches = new Map<string, string>()

  if (targetEmail) {
    const { data: directProfile } = await args.admin
      .from("profiles")
      .select("id,active_company_id")
      .eq("email", targetEmail)
      .eq("role", "company")
      .maybeSingle()

    if ((directProfile as any)?.active_company_id) {
      exactMatches.set(String((directProfile as any).active_company_id), "profile_email_match")
    }

    const { data: memberProfiles } = await args.admin
      .from("profiles")
      .select("email,active_company_id")
      .eq("role", "company")
      .eq("email", targetEmail)

    for (const row of Array.isArray(memberProfiles) ? memberProfiles : []) {
      const companyId = String((row as any)?.active_company_id || "").trim()
      if (!companyId) continue
      exactMatches.set(companyId, "company_member_email_match")
    }

    const { data: directCompanyProfile } = await args.admin
      .from("company_profiles")
      .select("company_id,contact_email")
      .eq("contact_email", targetEmail)
      .maybeSingle()

    if ((directCompanyProfile as any)?.company_id) {
      exactMatches.set(String((directCompanyProfile as any).company_id), "company_contact_email_match")
    }
  }

  if (exactMatches.size === 1) {
    const [companyId, resolution] = Array.from(exactMatches.entries())[0]
    return {
      companyId,
      resolution,
    }
  }

  if (exactMatches.size > 1) {
    return {
      companyId: null,
      resolution: "ambiguous_exact_match",
    }
  }

  if (domain && !FREE_EMAIL_DOMAINS.has(domain) && !DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    const [{ data: candidateProfiles }, { data: memberProfiles }] = await Promise.all([
      args.admin
        .from("company_profiles")
        .select("company_id,website_url,contact_email,trade_name,legal_name,company_name"),
      args.admin
        .from("profiles")
        .select("email,active_company_id")
        .eq("role", "company"),
    ])

    for (const row of Array.isArray(candidateProfiles) ? candidateProfiles : []) {
      const companyId = String((row as any)?.company_id || "").trim()
      if (!companyId) continue
      const websiteDomain = normalizeHost(row?.website_url)
      const contactDomain = normalizeEmailDomain(row?.contact_email)
      if (websiteDomain && websiteDomain === domain) {
        domainMatches.set(companyId, "company_website_domain_match")
        continue
      }
      if (contactDomain && contactDomain === domain) {
        domainMatches.set(companyId, "company_contact_domain_match")
        continue
      }
      const displayName = asText(row?.trade_name || row?.legal_name || row?.company_name)
      if (domainIncludesCompany(domain, companyName || displayName || null)) {
        domainMatches.set(companyId, "company_name_domain_match")
      }
    }

    for (const row of Array.isArray(memberProfiles) ? memberProfiles : []) {
      const companyId = String((row as any)?.active_company_id || "").trim()
      const memberDomain = normalizeEmailDomain((row as any)?.email)
      if (!companyId || !memberDomain) continue
      if (memberDomain === domain) {
        domainMatches.set(companyId, "company_member_domain_match")
      }
    }
  }

  if (domainMatches.size === 1) {
    const [companyId, resolution] = Array.from(domainMatches.entries())[0]
    return {
      companyId,
      resolution,
    }
  }

  if (domainMatches.size > 1) {
    return {
      companyId: null,
      resolution: "ambiguous_domain_match",
    }
  }

  return {
    companyId: null,
    resolution: "unresolved",
  }
}
