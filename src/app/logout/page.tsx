import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export default async function LogoutPage() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}
