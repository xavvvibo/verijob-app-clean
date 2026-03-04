import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Sidebar from "./_components/layout/Sidebar";
import Topbar from "./_components/layout/Topbar";

export default async function PrivateLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  // Si no hay profile por lo que sea, mandamos a onboarding (pero sin loop, porque ya no lo hacemos aquí)
  const role = profile?.role ?? "candidate";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", minHeight: "100vh", background: "#F8FAFC" }}>
      <Sidebar role={role} />
      <div>
        <Topbar />
        <main style={{ padding: "32px" }}>{children}</main>
      </div>
    </div>
  );
}
