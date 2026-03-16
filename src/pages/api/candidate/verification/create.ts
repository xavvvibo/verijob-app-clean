import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { createPagesRouteClient } from "@/utils/supabase/pages";
import { createServiceRoleClient } from "@/utils/supabase/service";
import {
  isMissingExternalResolvedColumn,
  isVerificationExternallyResolved,
} from "@/lib/verification/external-resolution";

const ACTIVE_STATUSES = new Set(["pending", "pending_company", "sent", "opened", "reviewing"]);

function asText(value: unknown) {
  return String(value || "").trim();
}

function newToken() {
  return crypto.randomBytes(16).toString("hex");
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

    const insertPayload = {
      employment_record_id: employmentRecordId || null,
      company_email_target: companyEmail,
      external_email_target: companyEmail,
      company_name_target: companyName,
      requested_by: userId,
      verification_type: "employment",
      verification_channel: "email",
      status: "pending_company",
      requested_at: new Date().toISOString(),
      external_token: newToken(),
      external_token_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      request_context: {
        source: "candidate_experience_request",
        source_profile_experience_id: verifiedProfileExperienceId || null,
        company_name_freeform: companyName,
        position: roleTitle,
        start_date: asText(start_date) || null,
        end_date: asText(end_date) || null,
        is_current: Boolean(is_current),
      },
    };

    const { data, error } = await admin
      .from("verification_requests")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error("verification_create_error", error);
      return res.status(500).json({ error: "verification_create_failed", details: error.message });
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
