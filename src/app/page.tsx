import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // App subdomain: si no hay sesión, a login (evita loops/500 en /dashboard)
  if (!user) redirect("/login");

  redirect("/dashboard");
}
