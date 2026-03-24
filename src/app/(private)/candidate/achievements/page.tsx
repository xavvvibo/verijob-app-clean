import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import DashboardShell from "@/app/_components/DashboardShell";
import LanguagesClient from "./LanguagesClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();
  if (!au.user) redirect("/login");

  const { data: items } = await supabase
    .from("candidate_languages")
    .select("*")
    .eq("user_id", au.user.id)
    .order("created_at", { ascending: false });

  return (
    <DashboardShell title="Idiomas y logros">
      <LanguagesClient initialItems={items || []} />
    </DashboardShell>
  );
}
