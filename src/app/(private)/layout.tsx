import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { resolveSessionRole } from "@/lib/auth/session-role";
import PrivateShell from "./_components/layout/PrivateShell";

export default async function PrivateLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,active_company_id")
    .eq("id", user.id)
    .maybeSingle();
  const role = resolveSessionRole({
    profileRole: profile?.role,
    activeCompanyId: (profile as any)?.active_company_id,
    user,
  }) || "candidate";

  return <PrivateShell role={role}>{children}</PrivateShell>;
}
