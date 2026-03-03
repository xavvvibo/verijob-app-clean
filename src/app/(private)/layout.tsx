import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Sidebar from "./_components/layout/Sidebar";
import Topbar from "./_components/layout/Topbar";

export default async function PrivateLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, onboarding_completed")
    .eq("id", user.id)
    .single();

  if (!profile?.onboarding_completed) redirect("/onboarding");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", minHeight: "100vh", background: "#F8FAFC" }}>
      <Sidebar role={profile.role} />
      <div>
        <Topbar />
        <main style={{ padding: "32px" }}>{children}</main>
      </div>
    </div>
  );
}
