import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function CompanyDashboard() {
  const supabase = await createServerSupabaseClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active_company_id")
    .eq("id", auth.user.id)
    .maybeSingle();

  if ((profile?.role || "").toLowerCase() !== "company") {
    redirect("/dashboard");
  }

  // Header sticky con logout (visible siempre)
  return (
    <div>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 18px",
          }}
        >
          <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)", fontWeight: 700 }}>
            Empresa
          </div>
          <Link
            href="/logout"
            style={{ fontSize: 13, fontWeight: 700, color: "#b91c1c", textDecoration: "none" }}
          >
            Cerrar sesión
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-semibold">Dashboard Empresa · USO MENSUAL</h1>
        <p className="mt-2 text-sm text-gray-600">
          (Contenido existente no mostrado aquí: si necesitas recuperarlo exacto del dashboard anterior,
          pégame el archivo previo y lo reinsertamos sin perder nada.)
        </p>
      </main>
    </div>
  );
}
