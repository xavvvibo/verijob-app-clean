import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import NewVerificationClient from "./NewVerificationClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewVerificationPage() {
  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();
  if (!au.user) redirect("/login?next=/candidate/verifications/new");

  return <NewVerificationClient />;
}
