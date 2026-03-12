import { createClient } from "@/utils/supabase/server";
import OwnerTooltip from "@/components/ui/OwnerTooltip";

export const dynamic = "force-dynamic";

function eur(n: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
}

function planLabel(raw: unknown) {
  const v = String(raw || "").trim();
  return v || "free";
}

export default async function OwnerMonetizationPage() {
  const supabase = await createClient();

  const { data: subscriptions } = await supabase
    .from("subscriptions")
    .select("id,user_id,plan,status,current_period_end,amount,currency,created_at,metadata")
    .order("created_at", { ascending: false })
    .limit(1500);

  const rows = Array.isArray(subscriptions) ? subscriptions : [];
  const activeRows = rows.filter((r: any) => {
    const s = String(r.status || "").toLowerCase();
    return s === "active" || s === "trialing";
  });

  const canceledRows = rows.filter((r: any) => String(r.status || "").toLowerCase() === "canceled");
  const newThis30d = rows.filter((r: any) => {
    if (!r.created_at) return false;
    return new Date(r.created_at).getTime() >= Date.now() - 30 * 24 * 60 * 60 * 1000;
  }).length;

  const mrrFromAmount = activeRows.reduce((acc: number, row: any) => acc + Number(row.amount || 0), 0) / 100;
  const churnRate = activeRows.length + canceledRows.length > 0
    ? Math.round((canceledRows.length / (activeRows.length + canceledRows.length)) * 100)
    : 0;

  const planStats = new Map<string, { active: number; mrr: number; total: number }>();
  for (const row of rows as any[]) {
    const plan = planLabel(row.plan || row.metadata?.plan_key);
    const st = planStats.get(plan) || { active: 0, mrr: 0, total: 0 };
    st.total += 1;
    const status = String(row.status || "").toLowerCase();
    if (status === "active" || status === "trialing") {
      st.active += 1;
      st.mrr += Number(row.amount || 0) / 100;
    }
    planStats.set(plan, st);
  }

  const sortedPlans = Array.from(planStats.entries()).sort((a, b) => b[1].mrr - a[1].mrr);

  const latestRows = rows.slice(0, 80);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Monetización</h1>
        <p className="mt-1 text-sm text-slate-600">
          Vista ejecutiva de ingresos y suscripciones. Stripe LIVE está operativo y este panel refleja datos locales de subscripciones.
        </p>
        <p className="mt-2 text-xs text-slate-500 inline-flex items-center gap-2">
          Definiciones de monetización
          <OwnerTooltip text="MRR = ingreso mensual recurrente de suscripciones activas/trialing. Churn y altas son aproximaciones según estado de subscripciones en base de datos." />
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">MRR estimado</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{eur(mrrFromAmount)}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suscripciones activas</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{activeRows.length}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Altas últimos 30 días</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{newThis30d}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Canceladas</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{canceledRows.length}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Churn aprox.</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{churnRate}%</p>
        </article>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Resumen por plan</h2>
        <p className="mt-1 text-sm text-slate-600">Distribución activa y aportación mensual estimada por plan.</p>
        {sortedPlans.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            No hay datos suficientes en `subscriptions` para construir resumen por plan.
          </div>
        ) : (
          <div className="mt-4 overflow-auto">
            <table className="min-w-[760px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">Plan</th>
                  <th className="px-3 py-3">Activas</th>
                  <th className="px-3 py-3">Totales</th>
                  <th className="px-3 py-3">MRR estimado</th>
                </tr>
              </thead>
              <tbody>
                {sortedPlans.map(([plan, stat]) => (
                  <tr key={plan} className="border-b border-slate-100 text-slate-800">
                    <td className="px-3 py-3 font-semibold text-slate-900">{plan}</td>
                    <td className="px-3 py-3">{stat.active}</td>
                    <td className="px-3 py-3">{stat.total}</td>
                    <td className="px-3 py-3 font-semibold text-slate-900">{eur(stat.mrr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Últimas suscripciones</h2>
        <p className="mt-1 text-sm text-slate-600">Últimos eventos registrados para control de altas y renovaciones.</p>

        {latestRows.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            Todavía no hay filas en `subscriptions` para mostrar.
          </div>
        ) : (
          <div className="mt-4 overflow-auto">
            <table className="min-w-[980px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">Plan</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Importe</th>
                  <th className="px-3 py-3">Usuario</th>
                  <th className="px-3 py-3">Renovación</th>
                  <th className="px-3 py-3">Alta</th>
                </tr>
              </thead>
              <tbody>
                {latestRows.map((row: any) => (
                  <tr key={row.id} className="border-b border-slate-100 text-slate-800">
                    <td className="px-3 py-3 font-semibold text-slate-900">{planLabel(row.plan || row.metadata?.plan_key)}</td>
                    <td className="px-3 py-3">{row.status || "—"}</td>
                    <td className="px-3 py-3">{typeof row.amount === "number" ? eur(Number(row.amount) / 100) : "—"}</td>
                    <td className="px-3 py-3">{row.user_id || "—"}</td>
                    <td className="px-3 py-3">{row.current_period_end ? new Date(row.current_period_end).toLocaleDateString("es-ES") : "—"}</td>
                    <td className="px-3 py-3">{row.created_at ? new Date(row.created_at).toLocaleDateString("es-ES") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
