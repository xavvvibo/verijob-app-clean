import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import NewVerificationClient from "./NewVerificationClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewVerificationPage() {
  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();
  if (!au.user) redirect("/login?next=/candidate/verifications/new");

  const { data: experiences } = await supabase
    .from("profile_experiences")
    .select("id, role_title, company_name, start_date, end_date")
    .eq("user_id", au.user.id)
    .order("created_at", { ascending: false });

  const { data: employmentRows } = await supabase
    .from("employment_records")
    .select("id, position, company_name_freeform, start_date, end_date")
    .eq("candidate_id", au.user.id);

  function norm(v: unknown) {
    return String(v || "").trim().toLowerCase();
  }

  function matchKey(input: any) {
    return [
      norm(input?.role_title ?? input?.position),
      norm(input?.company_name ?? input?.company_name_freeform),
      norm(input?.start_date),
      norm(input?.end_date),
    ].join("|");
  }

  const employmentBySignature = new Map<string, string>();
  for (const row of employmentRows || []) {
    const key = matchKey(row);
    if (key && !employmentBySignature.has(key)) {
      employmentBySignature.set(key, String((row as any)?.id || ""));
    }
  }

  const mappedExperiences = (experiences || []).map((experience: any) => ({
    ...experience,
    profile_experience_id: String(experience.id),
    employment_record_id: employmentBySignature.get(matchKey(experience)) || "",
  }));

  return <NewVerificationClient experiences={mappedExperiences} />;
}
