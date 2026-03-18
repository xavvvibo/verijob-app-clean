import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { resolveSessionRole } from "@/lib/auth/session-role";
import Sidebar from "./_components/layout/Sidebar";
import Topbar from "./_components/layout/Topbar";

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

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", minHeight: "100vh", background: "#F8FAFC" }}>
      <Sidebar role={role} />
      <div>
        <Topbar role={role} />
        <main style={{ padding: "32px" }}>{children}</main>
      </div>
    </div>
  );
}
