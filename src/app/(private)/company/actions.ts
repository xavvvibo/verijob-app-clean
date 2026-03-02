"use server";

import { createClient } from "@/utils/supabase/server";

type SetCompanyVerificationStatusInput = {
  verificationRequestId: string;
  nextStatus: string;
  note?: string;
};

async function requireUser() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) throw new Error("Unauthorized");
  return supabase;
}

/**
 * Matches DecisionPanel call signature:
 * setCompanyVerificationStatus({ verificationRequestId, nextStatus, note })
 */
export async function setCompanyVerificationStatus(input: SetCompanyVerificationStatusInput) {
  const supabase = await requireUser();

  const { verificationRequestId, nextStatus } = input;

  const { error } = await supabase
    .from("verification_requests")
    .update({ status: nextStatus })
    .eq("id", verificationRequestId);

  if (error) throw new Error(error.message);

  return { ok: true };
}

/**
 * Detail for company verification view.
 * Tries verification_summary first (view), falls back to verification_requests.
 */
export async function getCompanyVerificationDetail(verificationRequestId: string) {
  const supabase = await requireUser();

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
