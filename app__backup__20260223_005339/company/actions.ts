"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

type VerificationStatus =
  | "pending"
  | "pending_company"
  | "pending_review"
  | "verified"
  | "rejected";

export async function getCompanyVerificationInbox() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("verification_requests")
    .select(
      `
        id,
        status,
        created_at,
        employment_record:employment_records (
          id,
          position,
          start_date,
          end_date,
          candidate:profiles (
            id,
            email
          )
        ),
        evidences:evidences ( id )
      `
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (
    data?.map((vr: any) => ({
      id: vr.id,
      status: vr.status as VerificationStatus,
      created_at: vr.created_at as string,
      position: vr.employment_record?.position ?? "",
      start_date: vr.employment_record?.start_date ?? null,
      end_date: vr.employment_record?.end_date ?? null,
      candidate_email: vr.employment_record?.candidate?.email ?? "",
      evidences_count: Array.isArray(vr.evidences) ? vr.evidences.length : 0,
    })) ?? []
  );
}

export async function getCompanyVerificationDetail(verificationRequestId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("verification_requests")
    .select(
      `
        id,
        status,
        created_at,
        employment_record:employment_records (
          id,
          position,
          start_date,
          end_date,
          company_id,
          candidate_id,
          candidate:profiles (
            id,
            email,
            full_name
          )
        ),
        evidences:evidences (
          id,
          storage_path,
          evidence_type,
          uploaded_by,
          created_at
        )
      `
    )
    .eq("id", verificationRequestId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data;
}

export async function getVerificationActions(verificationRequestId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("verification_actions")
    .select("id, verification_request_id, actor_id, action, metadata, created_at")
    .eq("verification_request_id", verificationRequestId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return data ?? [];
}

export async function setCompanyVerificationStatus(params: {
  verificationRequestId: string;
  nextStatus: "verified" | "rejected";
  note?: string;
}) {
  const supabase = await createClient();
  const { verificationRequestId, nextStatus, note } = params;

  const { data: userData } = await supabase.auth.getUser();
  const actorId = userData?.user?.id ?? null;

  const { error: updateError } = await supabase
    .from("verification_requests")
    .update({ status: nextStatus })
    .eq("id", verificationRequestId);

  if (updateError) throw new Error(updateError.message);

  const { error: actionError } = await supabase.from("verification_actions").insert({
    verification_request_id: verificationRequestId,
    actor_id: actorId,
    action: nextStatus === "verified" ? "company_approved" : "company_rejected",
    metadata: note ? { note } : null,
  });

  if (actionError) throw new Error(actionError.message);

  revalidatePath("/company/dashboard");
  revalidatePath(`/company/verification/${verificationRequestId}`);
}
