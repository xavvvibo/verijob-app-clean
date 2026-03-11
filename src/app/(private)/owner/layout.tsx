import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();

  if (!au.user) redirect("/login?next=/owner/overview");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", au.user.id)
    .maybeSingle();

  const role = String(profile?.role || "").toLowerCase();
  if (role !== "owner" && role !== "admin") {
    if (role === "candidate") redirect("/candidate/overview?forbidden=1&from=owner");
    if (role === "company") redirect("/company?forbidden=1&from=owner");
    redirect("/dashboard?forbidden=1&from=owner");
  }

  return <>{children}</>;
}
