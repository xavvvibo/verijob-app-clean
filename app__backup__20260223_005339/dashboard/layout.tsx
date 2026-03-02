import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Sidebar from "@/components/dashboard/Sidebar";
import Topbar from "@/components/dashboard/Topbar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, company_name, onboarding_completed")
    .eq("id", user.id)
    .single();

  // Si no hay profile todavía, redirigimos a un onboarding simple (lo haremos después).
  if (!profile) redirect("/login");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", minHeight: "100vh" }}>
      <Sidebar role={profile.role} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <Topbar
          role={profile.role}
          name={profile.full_name || user.email || "Usuario"}
        />
        <main style={{ padding: 24 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
