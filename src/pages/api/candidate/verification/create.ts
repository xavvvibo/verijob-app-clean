import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { createPagesRouteClient } from "@/utils/supabase/pages";
import { createServiceRoleClient } from "@/utils/supabase/service";
import {
  isMissingExternalResolvedColumn,
  isVerificationExternallyResolved,
} from "@/lib/verification/external-resolution";

const ACTIVE_STATUSES = new Set(["pending", "pending_company", "sent", "opened", "reviewing"]);
const LEGACY_COMPANY_VERIFICATION_STATUSES = new Set(["unverified", "verified_document", "verified_paid"]);

function asText(value: unknown) {
  return String(value || "").trim();
}

function newToken() {
  return crypto.randomBytes(16).toString("hex");
}

function normalizeCompanyVerificationStatusSnapshot(value: unknown) {
  const status = asText(value).toLowerCase();
  if (!status) return null;
  if (LEGACY_COMPANY_VERIFICATION_STATUSES.has(status)) return status;
  if (status === "registered_in_verijob") return "verified_paid";
  if (status === "unverified_external") return "unverified";
  return "unverified";
}

function missingColumnFromError(error: any) {
  const message = String(error?.message || "");
  const match = message.match(/column ["']?([a-zA-Z0-9_]+)["']? does not exist/i);
  return match?.[1] ? String(match[1]) : null;
}

function buildInsertVariants(payload: Record<string, any>) {
  const without = (source: Record<string, any>, keys: string[]) => {
    const next = { ...source };
    for (const key of keys) delete next[key];
    return next;
  };

  return [
    { label: "full", payload },
    { label: "without_verification_type", payload: without(payload, ["verification_type"]) },
    {
      label: "without_snapshots",
      payload: without(payload, [
        "verification_type",
        "company_id_snapshot",
        "company_name_snapshot",
        "company_verification_status_snapshot",
        "snapshot_at",
      ]),
    },
    {
      label: "without_external_fields",
      payload: without(payload, [
        "verification_type",
        "company_id_snapshot",
        "company_name_snapshot",
        "company_verification_status_snapshot",
        "snapshot_at",
        "external_email_target",
        "external_token",
        "external_token_expires_at",
      ]),
    },
    {
      label: "minimal_legacy",
      payload: {
        employment_record_id: payload.employment_record_id,
        company_id: payload.company_id,
        company_email_target: payload.company_email_target,
        company_name_target: payload.company_name_target,
        requested_by: payload.requested_by,
        verification_channel: payload.verification_channel,
        status: payload.status,
        requested_at: payload.requested_at,
        request_context: payload.request_context,
      },
    },
  ];
}

function shouldRetryVerificationInsert(error: any) {
  const code = String(error?.code || "").trim();
  const message = String(error?.message || "").toLowerCase();
  return (
    code === "42703" ||
    code === "PGRST204" ||
    message.includes("does not exist") ||
    message.includes("column") ||
    message.includes("schema cache") ||
    message.includes("violates check constraint")
  );
}

async function insertVerificationRequestCompat(admin: any, payload: Record<string, any>) {
  const attempts: Array<{ label: string; error?: string | null; missing_column?: string | null }> = [];
  let lastError: any = null;

  for (const variant of buildInsertVariants(payload)) {
    const { data, error } = await admin
      .from("verification_requests")
      .insert(variant.payload)
      .select()
      .single();

    if (!error && data) {
      return {
        data,
        attempts,
      };
    }

    lastError = error;
    attempts.push({
      label: variant.label,
      error: String(error?.message || "unknown_error"),
      missing_column: missingColumnFromError(error),
    });

    if (!shouldRetryVerificationInsert(error)) {
      break;
    }
  }

  return {
    data: null,
    error: lastError,
    attempts,
  };
}

async function resolveRegisteredCompanyTarget(admin: any, companyEmail: string) {
  const normalizedEmail = asText(companyEmail).toLowerCase();
  if (!normalizedEmail) {
    return {
      companyId: null,
      companyNameSnapshot: null,
      companyVerificationStatusSnapshot: null,
    };
  }

  const { data: matchedProfile } = await admin
    .from("profiles")
    .select("active_company_id")
    .eq("email", normalizedEmail)
    .eq("role", "company")
    .maybeSingle();

  const companyId = (matchedProfile as any)?.active_company_id ? String((matchedProfile as any).active_company_id) : null;
  if (!companyId) {
    return {
      companyId: null,
      companyNameSnapshot: null,
      companyVerificationStatusSnapshot: null,
    };
  }

  const [{ data: company }, { data: companyProfile }] = await Promise.all([
    admin.from("companies").select("name,company_verification_status").eq("id", companyId).maybeSingle(),
    admin.from("company_profiles").select("trade_name,legal_name").eq("company_id", companyId).maybeSingle(),
  ]);

  const companyNameSnapshot = asText(
    (companyProfile as any)?.trade_name ||
      (companyProfile as any)?.legal_name ||
      (company as any)?.name
  ) || null;
  const companyVerificationStatusSnapshot =
    asText((company as any)?.company_verification_status) || null;

  return {
    companyId,
    companyNameSnapshot,
    companyVerificationStatusSnapshot,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const supabase = createPagesRouteClient(req, res);
    const {
      data: auth,
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !auth?.user) {
      return res.status(401).json({ error: "unauthorized" });
    }
    const admin = createServiceRoleClient();

    const {
      employment_record_id,
      company_email,
      company_name_freeform,
      position,
      start_date,
      end_date,
      is_current,
      source_profile_experience_id,
    } = req.body;

    const userId = auth.user.id;
    const companyEmail = asText(company_email).toLowerCase();
    const companyName = asText(company_name_freeform);
    const roleTitle = asText(position);
    const sourceProfileExperienceId = asText(source_profile_experience_id || employment_record_id);
    let employmentRecordId = asText(employment_record_id);

    if (!companyEmail || !companyName || !roleTitle) {
      return res.status(400).json({ error: "missing_fields" });
    }

    let verifiedProfileExperienceId = sourceProfileExperienceId;
    if (sourceProfileExperienceId) {
      const { data: profileExperience, error: profileExpErr } = await admin
        .from("profile_experiences")
        .select("id")
        .eq("id", sourceProfileExperienceId)
        .eq("user_id", userId)
        .maybeSingle();

      if (profileExpErr) {
        return res.status(400).json({ error: "profile_experience_lookup_failed", details: profileExpErr.message });
      }
      if (!profileExperience) {
        return res.status(404).json({ error: "profile_experience_not_found" });
      }
      verifiedProfileExperienceId = String(profileExperience.id);
    }

    if (employmentRecordId) {
      const { data: employmentRecord } = await admin
        .from("employment_records")
        .select("id")
        .eq("id", employmentRecordId)
        .eq("candidate_id", userId)
        .maybeSingle();
      if (!employmentRecord) {
        employmentRecordId = "";
      }
    }

    let existingRows: any[] = [];
    const primaryExisting = await admin
      .from("verification_requests")
      .select("id,status,resolved_at,revoked_at,employment_record_id,request_context,external_resolved")
      .eq("requested_by", userId)
      .or(`company_email_target.eq.${companyEmail},external_email_target.eq.${companyEmail}`)
      .order("created_at", { ascending: false })
      .limit(20);

    existingRows = Array.isArray(primaryExisting.data) ? primaryExisting.data : [];

    if (primaryExisting.error && isMissingExternalResolvedColumn(primaryExisting.error)) {
      const fallbackExisting = await admin
        .from("verification_requests")
        .select("id,status,resolved_at,revoked_at,employment_record_id,request_context")
        .eq("requested_by", userId)
        .or(`company_email_target.eq.${companyEmail},external_email_target.eq.${companyEmail}`)
        .order("created_at", { ascending: false })
        .limit(20);
      if (fallbackExisting.error) {
        return res.status(400).json({
          error: "active_verification_lookup_failed",
          details: fallbackExisting.error.message,
        });
      }
      existingRows = Array.isArray(fallbackExisting.data) ? fallbackExisting.data : [];
    } else if (primaryExisting.error) {
      return res.status(400).json({
        error: "active_verification_lookup_failed",
        details: primaryExisting.error.message,
      });
    }

    const existing = existingRows.find((row: any) => {
      const status = String(row?.status || "").toLowerCase();
      if (!ACTIVE_STATUSES.has(status)) return false;
      if (row?.revoked_at || isVerificationExternallyResolved(row)) return false;

      const rowSourceProfileExperienceId = asText(row?.request_context?.source_profile_experience_id);
      if (verifiedProfileExperienceId && rowSourceProfileExperienceId) {
        return rowSourceProfileExperienceId === verifiedProfileExperienceId;
      }

      if (employmentRecordId && row?.employment_record_id) {
        return String(row.employment_record_id) === employmentRecordId;
      }

      return asText(row?.request_context?.position).toLowerCase() === roleTitle.toLowerCase();
    });

    if (existing) {
      return res.status(200).json({
        already_exists: true,
        verification_id: existing.id
      });
    }

    const targetCompany = await resolveRegisteredCompanyTarget(admin, companyEmail);
    const requestedAt = new Date().toISOString();
    const insertPayload = {
      employment_record_id: employmentRecordId || null,
      company_id: targetCompany.companyId,
      company_email_target: companyEmail,
      external_email_target: companyEmail,
      company_name_target: companyName,
      requested_by: userId,
      verification_type: "employment",
      verification_channel: "email",
      status: "pending_company",
      requested_at: requestedAt,
      external_token: newToken(),
      external_token_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      company_id_snapshot: targetCompany.companyId,
      company_name_snapshot: targetCompany.companyNameSnapshot || companyName || null,
      company_verification_status_snapshot: normalizeCompanyVerificationStatusSnapshot(targetCompany.companyVerificationStatusSnapshot),
      snapshot_at: targetCompany.companyId ? requestedAt : null,
      request_context: {
        source: "candidate_experience_request",
        source_profile_experience_id: verifiedProfileExperienceId || null,
        company_name_freeform: companyName,
        position: roleTitle,
        start_date: asText(start_date) || null,
        end_date: asText(end_date) || null,
        is_current: Boolean(is_current),
        target_company_registered: Boolean(targetCompany.companyId),
      },
    };

    const insertResult = await insertVerificationRequestCompat(admin, insertPayload);
    const data = insertResult.data;
    const error = (insertResult as any).error;

    if (error) {
      console.error("verification_create_error", {
        error,
        attempts: insertResult.attempts,
        user_id: userId,
        company_email: companyEmail,
        employment_record_id: employmentRecordId || null,
        source_profile_experience_id: verifiedProfileExperienceId || null,
      });
      return res.status(500).json({
        error: "verification_create_failed",
        details: error.message,
        diagnostic_code: "verification_insert_compat_failed",
      });
    }

    if (verifiedProfileExperienceId) {
      await admin
        .from("profile_experiences")
        .update({
          matched_verification_id: data.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", verifiedProfileExperienceId)
        .eq("user_id", userId);
    }

    return res.status(200).json({
      success: true,
      verification_id: data.id,
      verification_request_id: data.id,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal_error" });
  }
}
