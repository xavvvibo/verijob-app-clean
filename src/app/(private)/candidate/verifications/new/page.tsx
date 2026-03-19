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
    .select("id, role_title, company_name")
    .eq("user_id", au.user.id)
    .order("created_at", { ascending: false });

  return <NewVerificationClient experiences={experiences || []} />;
}
