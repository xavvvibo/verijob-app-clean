import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

function planLabel(planRaw: unknown) {
  const plan = String(planRaw || "").toLowerCase();
  if (plan.includes("company_team")) return "Team";
  if (plan.includes("company_hiring")) return "Hiring";
  if (plan.includes("company_access")) return "Access";
  if (plan.includes("company_enterprise")) return "Enterprise";
  return "Free";
}

function formatDate(value?: string | null) {
  if (!value) return "No disponible";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "No disponible";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function planFeatures(label: string) {
  if (label === "Team") return ["Mayor capacidad operativa", "Mayor volumen de revisión", "Escalado de equipo y trazabilidad"];
  if (label === "Hiring") return ["Más revisiones simultáneas", "Acceso ampliado a candidatos", "Mejor throughput de validación"];
  if (label === "Access") return ["Acceso básico a revisión", "Consulta de candidatos por token", "Gestión inicial de solicitudes"];
  if (label === "Enterprise") return ["Capacidad avanzada", "Operación a gran escala", "Acuerdos personalizados"];
  return ["Panel básico", "Solicitudes en modo limitado", "Visibilidad del valor premium para upgrade"];
}

export default async function CompanyBillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan,status,current_period_end,cancel_at_period_end")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const label = planLabel(sub?.plan);
  const status = String(sub?.status || "free").toLowerCase();
  const isActive = status === "active" || status === "trialing";
  const features = planFeatures(label);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Suscripción de empresa</h1>
        <p className="mt-2 text-sm text-slate-600">
          Consulta el estado de tu plan, límites operativos y opciones para ampliar capacidad de revisión.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Estado actual</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Plan</dt>
              <dd className="font-semibold text-slate-900">{label}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Estado</dt>
              <dd className="font-semibold text-slate-900">{isActive ? "Activo" : "Sin suscripción activa"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Próxima renovación</dt>
              <dd className="font-semibold text-slate-900">{formatDate(sub?.current_period_end || null)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Cancelación programada</dt>
              <dd className="font-semibold text-slate-900">{sub?.cancel_at_period_end ? "Sí" : "No"}</dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/company/upgrade" className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black transition">
              Mejorar plan
            </Link>
            <a href="/company" className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition">
              Volver al dashboard
            </a>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            El portal de facturación Stripe para empresas se conecta en el siguiente bloque de monetización. Mientras tanto, el estado del plan se refleja aquí.
          </p>
        </article>

        <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-base font-semibold text-slate-900">Qué incluye tu nivel actual</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {features.map((feature) => (
              <li key={feature}>• {feature}</li>
            ))}
          </ul>

          {!isActive ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Activa un plan para ampliar candidatos consultables, ritmo de revisión y capacidad de equipo.
            </div>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
