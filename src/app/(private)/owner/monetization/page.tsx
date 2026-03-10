import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

function eur(n: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
}

function planLabel(raw: unknown) {
  const v = String(raw || "");
  if (!v) return "free";
  return v;
}

export default async function OwnerMonetizationPage() {
  const supabase = await createClient();

  const { data: subscriptions } = await supabase
    .from("subscriptions")
    .select("id,user_id,plan,status,current_period_end,amount,currency,created_at,metadata")
    .order("created_at", { ascending: false })
    .limit(1000);

  const rows = Array.isArray(subscriptions) ? subscriptions : [];
  const activeRows = rows.filter((r: any) => {
    const s = String(r.status || "").toLowerCase();
    return s === "active" || s === "trialing";
  });

  const mrrFromAmount = activeRows.reduce((acc: number, row: any) => acc + Number(row.amount || 0), 0) / 100;

  const planCounts = new Map<string, number>();
  for (const row of activeRows as any[]) {
    const key = planLabel(row.plan || row.metadata?.plan_key);
    planCounts.set(key, (planCounts.get(key) || 0) + 1);
  }

  const totalSales = rows.length;
  const canceled = rows.filter((r: any) => String(r.status || "").toLowerCase() === "canceled").length;
  const churnRate = activeRows.length + canceled > 0 ? Math.round((canceled / (activeRows.length + canceled)) * 100) : 0;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Monetización</h1>
        <p className="mt-2 text-sm text-slate-600">
          Stripe LIVE operativo. Seguimiento interno de suscripciones, ventas y salud de ingresos por plan.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">MRR estimado</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{eur(mrrFromAmount)}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Suscripciones activas</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{activeRows.length}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Ventas / altas registradas</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{totalSales}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Churn aproximado</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{churnRate}%</p>
        </article>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Resumen por plan</h2>
        {planCounts.size === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            No hay suscripciones activas suficientes para generar el desglose por plan.
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {Array.from(planCounts.entries()).map(([plan, count]) => (
              <span key={plan} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                {plan}: {count}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Últimas suscripciones</h2>
        {rows.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            Todavía no hay filas en `subscriptions` para mostrar en este panel.
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
                {rows.slice(0, 80).map((row: any) => (
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
