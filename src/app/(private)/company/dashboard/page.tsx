import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PLAN_LIMIT = 20; // ajustar cuando conectemos Stripe real

export default async function CompanyDashboard() {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if ((profile?.role || "").toLowerCase() !== "company") {
    redirect("/dashboard");
  }

  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const { count } = await supabase
    .from("verification_requests")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startOfMonth.toISOString());

  const used = count || 0;
  const percentage = Math.min(Math.round((used / PLAN_LIMIT) * 100), 100);
  const showWarning = percentage >= 80;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <h1 className="text-3xl font-semibold">Dashboard Empresa · USO MENSUAL</h1>

      <div className="border rounded-xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-500">Uso mensual</p>
            <p className="text-2xl font-semibold">
              {used} / {PLAN_LIMIT} verificaciones
            </p>
          </div>
          <Link
            href="/company/upgrade"
            className="px-4 py-2 rounded-lg bg-black text-white text-sm"
          >
            Upgrade
          </Link>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className={`h-3 ${
              showWarning ? "bg-red-500" : "bg-black"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {showWarning && (
          <div className="text-sm text-red-600 font-medium">
            Estás utilizando el {percentage}% de tu límite mensual.
          </div>
        )}
      </div>

      <div className="border rounded-xl p-6">
        <p className="text-gray-600">
          Aquí aparecerán tus verificaciones recientes.
        </p>
      </div>
    </div>
  );
}
