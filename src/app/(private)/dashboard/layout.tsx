import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: au } = await supabase.auth.getUser();

  if (!au.user) redirect("/login?next=/dashboard");
  return <>{children}</>;
}
