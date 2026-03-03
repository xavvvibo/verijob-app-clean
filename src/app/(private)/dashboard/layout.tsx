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

  // Perfil para decidir rol (ajusta el select si tu schema difiere)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active_company_id")
    .eq("id", au.user.id)
    .maybeSingle();

  const role = String(profile?.role ?? "").toLowerCase();

  // Company: dashboard empresa (tu ruta real ya existe)
  if (role === "company") redirect("/company/dashboard");

  // Candidate (y cualquier otro no-company): nuevo dashboard candidato definitivo
  redirect("/candidate/overview");

  // unreachable
  return <>{children}</>;
}
