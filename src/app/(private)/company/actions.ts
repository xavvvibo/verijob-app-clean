"use server";

import { createClient } from "@/utils/supabase/server";
import { recalculateAndPersistCandidateTrustScore } from "@/server/trustScore/calculateTrustScore";
import { resolveCompanyDisplayName } from "@/lib/company/company-profile";
import { isCompanyLifecycleBlocked, readCompanyLifecycle } from "@/lib/company/lifecycle-guard";

type SetCompanyVerificationStatusInput = {
  verificationRequestId: string;
  nextStatus: string;
  note?: string;
};

async function requireUser() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) throw new Error("Unauthorized");
  return { supabase, user: auth.user };
}

async function resolveCompanyVerificationStatus(supabase: any, companyId: string, userId: string) {
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const subscriptionStatus = String(sub?.status || "").toLowerCase();
  if (subscriptionStatus === "active" || subscriptionStatus === "trialing") return "verified_paid";

  const { data: companyProfile } = await supabase
    .from("company_profiles")
    .select("company_verification_status,trade_name,legal_name")
    .eq("company_id", companyId)
    .maybeSingle();

  const { data: company } = await supabase
    .from("companies")
    .select("company_verification_status,name")
    .eq("id", companyId)
    .maybeSingle();

  if (company?.company_verification_status) {
    return {
      status: String(company.company_verification_status),
      companyName: resolveCompanyDisplayName({ ...(company || {}), ...(companyProfile || {}) }, "Tu empresa"),
    };
  }

  return {
    status: String(companyProfile?.company_verification_status || "unverified"),
    companyName: resolveCompanyDisplayName({ ...(company || {}), ...(companyProfile || {}) }, "Tu empresa"),
  };
}

/**
 * Matches DecisionPanel call signature:
 * setCompanyVerificationStatus({ verificationRequestId, nextStatus, note })
 */
export async function setCompanyVerificationStatus(input: SetCompanyVerificationStatusInput) {
  const { supabase, user } = await requireUser();

  const { verificationRequestId, nextStatus, note } = input;

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_company_id")
    .eq("id", user.id)
    .maybeSingle();

  const activeCompanyId = (profile as any)?.active_company_id;
  if (!activeCompanyId) throw new Error("No active company context");
  const companyLifecycle = await readCompanyLifecycle(supabase, String(activeCompanyId));
  if (!companyLifecycle.ok) throw new Error(companyLifecycle.error.message);
  if (isCompanyLifecycleBlocked(companyLifecycle.lifecycleStatus)) {
    throw new Error("La empresa esta desactivada o cerrada y no puede resolver verificaciones nuevas");
  }

  const { data: vr } = await supabase
    .from("verification_requests")
    .select("id,employment_record_id,company_id")
    .eq("id", verificationRequestId)
    .maybeSingle();

  if (!vr?.id) throw new Error("Verification request not found");
  if (vr.company_id && String(vr.company_id) !== String(activeCompanyId)) {
    throw new Error("Verification request does not belong to active company");
  }

  const resolvedAt = new Date().toISOString();
  const companyStatus = await resolveCompanyVerificationStatus(supabase, String(activeCompanyId), user.id);
  const companyVerificationStatusSnapshot =
    typeof companyStatus === "string" ? companyStatus : companyStatus.status;
  const companyNameSnapshot =
    typeof companyStatus === "string" ? null : companyStatus.companyName || null;

  const { data: updatedRequest, error } = await supabase
    .from("verification_requests")
    .update({
      status: nextStatus,
      resolved_by: user.id,
      resolved_at: resolvedAt,
      resolution_notes: note || null,
      company_id_snapshot: activeCompanyId,
      company_name_snapshot: companyNameSnapshot,
      company_verification_status_snapshot: companyVerificationStatusSnapshot,
      snapshot_at: resolvedAt,
    })
    .eq("id", verificationRequestId)
    .select("id,status,resolved_at,resolution_notes")
    .maybeSingle();

  if (error) throw new Error(error.message);

  const normalizedEmploymentStatus =
    nextStatus === "verified" ? "verified" : nextStatus === "rejected" ? "rejected" : "pending_company";

  if (vr.employment_record_id) {
    const { error: erErr } = await supabase
      .from("employment_records")
      .update({
        verification_status: normalizedEmploymentStatus,
        verification_result: nextStatus,
        verification_resolved_at: resolvedAt,
        verified_by_company_id: activeCompanyId,
        company_verification_status_snapshot: companyVerificationStatusSnapshot,
        last_verification_request_id: verificationRequestId,
      })
      .eq("id", vr.employment_record_id);
    if (erErr) throw new Error(erErr.message);

    const { data: employment } = await supabase
      .from("employment_records")
      .select("candidate_id")
      .eq("id", vr.employment_record_id)
      .maybeSingle();
    const candidateId = String((employment as any)?.candidate_id || "").trim();
    if (candidateId) {
      await recalculateAndPersistCandidateTrustScore(candidateId).catch(() => {});
    }
  }

  return {
    ok: true,
    request: updatedRequest || null,
    status: nextStatus,
    resolved_at: resolvedAt,
    message: nextStatus === "verified" ? "Experiencia confirmada." : "Experiencia rechazada.",
  };
}

/**
 * Detail for company verification view.
 * Tries verification_summary first (view), falls back to verification_requests.
 */
export async function getCompanyVerificationDetail(verificationRequestId: string) {
  const { supabase } = await requireUser();

  // 1) Try view: verification_summary
  const { data: summary, error: summaryErr } = await supabase
    .from("verification_summary")
    .select("*")
    .eq("verification_id", verificationRequestId)
    .maybeSingle();

  if (!summaryErr && summary) return summary;

  // 2) Fallback: verification_requests
  const { data: vr, error: vrErr } = await supabase
    .from("verification_requests")
    .select("*")
    .eq("id", verificationRequestId)
    .maybeSingle();

  if (vrErr) throw new Error(vrErr.message);
  if (!vr) return null;

  return vr;
}

/**
 * Placeholder to unblock build.
 * Connect this later to the real table/view that stores action history (e.g. verification_actions).
 */
export async function getVerificationActions(_verificationRequestId: string) {
  await requireUser();
  return [];
}
