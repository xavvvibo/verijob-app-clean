import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

function limitForPlan(planRaw: unknown) {
  const plan = String(planRaw || "").toLowerCase();
  if (plan.includes("company_team")) return 10;
  if (plan.includes("company_hiring")) return 5;
  if (plan.includes("company_access")) return 2;
  return 1;
}

function planLabel(planRaw: unknown) {
  const plan = String(planRaw || "").toLowerCase();
  if (plan.includes("company_team")) return "Team";
  if (plan.includes("company_hiring")) return "Hiring";
  if (plan.includes("company_access")) return "Access";
  return "Free";
}

export default async function CompanyTeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_company_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.active_company_id) redirect("/company");

  const [{ data: members }, { data: sub }] = await Promise.all([
    supabase
      .from("company_members")
      .select("user_id,role,created_at")
      .eq("company_id", profile.active_company_id)
      .order("created_at", { ascending: true }),
    supabase
      .from("subscriptions")
      .select("plan,status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const rows = members || [];
  const admins = rows.filter((row: any) => String(row.role || "").toLowerCase() === "admin").length;
  const reviewers = rows.filter((row: any) => String(row.role || "").toLowerCase() !== "admin").length;
  const plan = sub?.plan || "company_free";
  const seatsLimit = limitForPlan(plan);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Equipo y permisos</h1>
        <p className="mt-2 text-sm text-slate-600">
          Controla el acceso operativo de tu empresa y la capacidad de revisores según el plan activo.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Miembros activos</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{rows.length}</p>
          <p className="mt-2 text-sm text-slate-600">Capacidad del plan {planLabel(plan)}: {seatsLimit} usuario(s).</p>
        </article>
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Administradores</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{admins}</p>
          <p className="mt-2 text-sm text-slate-600">Gestionan permisos, facturación y configuración global.</p>
        </article>
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Revisores</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{reviewers}</p>
          <p className="mt-2 text-sm text-slate-600">Evalúan solicitudes y trazabilidad de verificaciones.</p>
        </article>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Modelo de permisos MVP</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          <li>• <span className="font-semibold text-slate-900">Admin</span>: gestión de plan, miembros y ajustes del command center.</li>
          <li>• <span className="font-semibold text-slate-900">Reviewer</span>: revisión de solicitudes, consulta de candidatos y reutilización.</li>
        </ul>

        {rows.length >= seatsLimit ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Has alcanzado el límite de usuarios de tu plan actual. Mejora plan para ampliar capacidad de equipo.
            <a href="/company/upgrade" className="ml-2 font-semibold underline underline-offset-2">Mejorar plan</a>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            Tu capacidad actual permite seguir creciendo el equipo sin fricción. La invitación directa por email se habilita en el siguiente bloque operativo.
          </p>
        )}
      </section>
    </div>
  );
}
