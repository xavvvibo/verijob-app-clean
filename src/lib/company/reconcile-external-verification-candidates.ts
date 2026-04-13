import { randomUUID } from "crypto";
import { ensureCandidatePublicToken } from "@/lib/company-candidate-import";
import { normalizeEmailDomain } from "@/lib/verification/verifier-email-signal";

function asText(value: unknown) {
  return String(value || "").trim();
}

function uniqueStrings(values: Array<unknown>) {
  return Array.from(
    new Set(
      values
        .map((value) => asText(value).toLowerCase())
        .filter(Boolean),
    ),
  );
}

function normalizeCompanyName(value: unknown) {
  return asText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeWebsiteDomain(value: unknown) {
  const raw = asText(value);
  if (!raw) return null;
  try {
    const url = raw.startsWith("http://") || raw.startsWith("https://") ? new URL(raw) : new URL(`https://${raw}`);
    return url.hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

function companyNamesReasonablyMatch(left: unknown, right: unknown) {
  const a = normalizeCompanyName(left);
  const b = normalizeCompanyName(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const aTokens = a.split(" ").filter((token) => token.length >= 3);
  const bTokens = b.split(" ").filter((token) => token.length >= 3);
  return aTokens.some((token) => bTokens.includes(token));
}

async function resolveCompanyIdentity(admin: any, companyId: string) {
  const [{ data: company }, { data: companyProfile }, { data: members }] = await Promise.all([
    admin
      .from("companies")
      .select("id,name")
      .eq("id", companyId)
      .maybeSingle(),
    admin
      .from("company_profiles")
      .select("company_id,trade_name,legal_name,contact_email,website_url")
      .eq("company_id", companyId)
      .maybeSingle(),
    admin
      .from("company_members")
      .select("user_id")
      .eq("company_id", companyId),
  ]);

  const memberIds = Array.isArray(members) ? members.map((row: any) => String(row?.user_id || "")).filter(Boolean) : [];
  const { data: memberProfiles } = memberIds.length
    ? await admin
        .from("profiles")
        .select("id,email")
        .in("id", memberIds)
    : { data: [] as any[] };

  const memberEmails = Array.isArray(memberProfiles) ? memberProfiles.map((row: any) => row?.email) : [];
  const companyEmails = uniqueStrings([companyProfile?.contact_email, ...memberEmails]);
  const companyDomains = uniqueStrings([
    ...companyEmails.map((email) => normalizeEmailDomain(email)),
    normalizeEmailDomain(companyProfile?.contact_email),
    normalizeWebsiteDomain(companyProfile?.website_url),
  ]);
  const companyNames = uniqueStrings([company?.name, companyProfile?.trade_name, companyProfile?.legal_name]);

  return {
    companyEmails,
    companyDomains,
    companyNames,
  };
}

function requestMatchesCompany(args: {
  row: any;
  companyId: string;
  companyEmails: string[];
  companyDomains: string[];
  companyNames: string[];
}) {
  const requestEmail = asText(args.row?.external_email_target).toLowerCase();
  const requestDomain = normalizeEmailDomain(requestEmail);
  const requestCompanyName = asText(args.row?.company_name_snapshot || args.row?.company_name_target);

  if (asText(args.row?.company_id) === args.companyId || asText(args.row?.company_id_snapshot) === args.companyId) {
    return true;
  }
  if (requestEmail && args.companyEmails.includes(requestEmail)) {
    return true;
  }
  if (requestDomain && args.companyDomains.includes(requestDomain)) {
    return args.companyNames.some((name) => companyNamesReasonablyMatch(name, requestCompanyName));
  }
  return false;
}

export async function reconcileExternalVerificationCandidates(args: {
  admin: any;
  companyId: string;
  invitedByUserId?: string | null;
}) {
  const { admin, companyId } = args;
  const identity = await resolveCompanyIdentity(admin, companyId);
  if (!identity.companyEmails.length && !identity.companyDomains.length) {
    return { inserted: 0, skipped: 0, matched: 0 };
  }

  const { data: existingInvites } = await admin
    .from("company_candidate_import_invites")
    .select("linked_user_id,candidate_email")
    .eq("company_id", companyId);

  const existingLinkedUserIds = new Set(
    (Array.isArray(existingInvites) ? existingInvites : [])
      .map((row: any) => asText(row?.linked_user_id))
      .filter(Boolean),
  );
  const existingCandidateEmails = new Set(
    (Array.isArray(existingInvites) ? existingInvites : [])
      .map((row: any) => asText(row?.candidate_email).toLowerCase())
      .filter(Boolean),
  );

  const { data: verificationRows, error: verificationErr } = await admin
    .from("verification_requests")
    .select("id,requested_by,status,verification_channel,resolved_at,created_at,updated_at,external_email_target,company_id,company_id_snapshot,company_name_target,company_name_snapshot,employment_record_id")
    .not("requested_by", "is", null)
    .not("resolved_at", "is", null)
    .in("status", ["verified", "rejected"])
    .eq("verification_channel", "email")
    .order("resolved_at", { ascending: false });

  if (verificationErr) throw verificationErr;

  const matchedRows = (Array.isArray(verificationRows) ? verificationRows : []).filter((row: any) =>
    requestMatchesCompany({
      row,
      companyId,
      companyEmails: identity.companyEmails,
      companyDomains: identity.companyDomains,
      companyNames: identity.companyNames,
    }),
  );

  const candidateIds = Array.from(
    new Set(matchedRows.map((row: any) => asText(row?.requested_by)).filter(Boolean)),
  );
  const employmentIds = Array.from(
    new Set(matchedRows.map((row: any) => asText(row?.employment_record_id)).filter(Boolean)),
  );

  const [{ data: candidateProfiles }, { data: employments }] = await Promise.all([
    candidateIds.length
      ? admin
          .from("profiles")
          .select("id,full_name,email")
          .in("id", candidateIds)
      : Promise.resolve({ data: [] as any[] }),
    employmentIds.length
      ? admin
          .from("employment_records")
          .select("id,position,company_name_freeform,start_date,end_date")
          .in("id", employmentIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const candidateById = new Map((Array.isArray(candidateProfiles) ? candidateProfiles : []).map((row: any) => [String(row.id), row]));
  const employmentById = new Map((Array.isArray(employments) ? employments : []).map((row: any) => [String(row.id), row]));

  const inserts: any[] = [];
  let skipped = 0;

  for (const row of matchedRows) {
    const candidateId = asText(row?.requested_by);
    if (!candidateId || existingLinkedUserIds.has(candidateId)) {
      skipped += 1;
      continue;
    }

    const candidateProfile = candidateById.get(candidateId);
    const candidateEmail = asText(candidateProfile?.email).toLowerCase();
    if (!candidateEmail || existingCandidateEmails.has(candidateEmail)) {
      skipped += 1;
      continue;
    }

    const employment = employmentById.get(asText(row?.employment_record_id));
    const candidatePublicToken = await ensureCandidatePublicToken(admin, candidateId).catch(() => null);
    const nowIso = new Date().toISOString();

    inserts.push({
      id: randomUUID(),
      company_id: companyId,
      invited_by_user_id: args.invitedByUserId || null,
      linked_user_id: candidateId,
      candidate_email: candidateEmail,
      candidate_name_raw: asText(candidateProfile?.full_name) || null,
      target_role: asText(employment?.position) || null,
      source: "external_verification",
      source_notes: `verification_request:${asText(row?.id)}`,
      storage_bucket: "candidate-cv",
      storage_path: `external-verification/${asText(row?.id)}`,
      original_filename: null,
      mime_type: null,
      size_bytes: null,
      cv_sha256: null,
      parse_status: "parsed_ready",
      invite_token: randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, ""),
      status: "converted",
      email_delivery_status: null,
      emailed_at: null,
      accepted_at: row?.resolved_at || nowIso,
      accepted_ip: null,
      accepted_user_agent: null,
      legal_text_version: null,
      last_error: null,
      extracted_payload_json: {
        _verijob_import_meta: {
          candidate_already_exists: true,
          existing_candidate_user_id: candidateId,
          existing_candidate_public_token: candidatePublicToken,
          processing_mode: "external_verification_reconciliation",
        },
        _verijob_external_verification: {
          verification_request_id: asText(row?.id),
          matched_by: asText(row?.external_email_target).toLowerCase(),
          resolved_at: row?.resolved_at || null,
          verification_status: asText(row?.status).toLowerCase() || null,
        },
      },
      extracted_warnings: [],
      created_at: row?.resolved_at || row?.created_at || nowIso,
      updated_at: row?.updated_at || row?.resolved_at || nowIso,
    });

    existingLinkedUserIds.add(candidateId);
    existingCandidateEmails.add(candidateEmail);
  }

  if (!inserts.length) {
    return { inserted: 0, skipped, matched: matchedRows.length };
  }

  const { error: insertErr } = await admin.from("company_candidate_import_invites").insert(inserts);
  if (insertErr) throw insertErr;

  return { inserted: inserts.length, skipped, matched: matchedRows.length };
}
