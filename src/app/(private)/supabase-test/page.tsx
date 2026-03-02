import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SupabaseTestPage() {
  // Flag OFF por defecto
  if (process.env.ENABLE_INTERNAL_DEBUG !== "true") {
    redirect("/dashboard");
  }

  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();

  if (!au.user) redirect("/login?next=/dashboard");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", au.user.id)
    .maybeSingle();

  const role = (profile?.role || "").toLowerCase();
  if (role !== "owner") redirect("/dashboard");

  // Render simple SSR (sin client keys)
  return (
    <pre style={{ padding: 24 }}>
      ✅ Internal debug route enabled. Supabase SSR auth OK.
    </pre>
  );
}
