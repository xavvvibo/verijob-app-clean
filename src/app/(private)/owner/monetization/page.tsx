import { createServiceRoleClient } from "@/utils/supabase/service";
import OwnerTooltip from "@/components/ui/OwnerTooltip";

export const dynamic = "force-dynamic";

function eurFromCents(cents: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format((Number.isFinite(cents) ? cents : 0) / 100);
}

function eur(n: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function planLabel(raw: unknown) {
  const v = String(raw || "").trim();
  return v || "free";
}

function productLabel(raw: unknown) {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "company_single_cv") return "1 visualización";
  if (v === "company_pack_5") return "Pack 5 visualizaciones";
  return v || "—";
}

function fmtDate(value: unknown) {
  if (!value) return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-ES");
}

export default async function OwnerMonetizationPage() {
  const supabase = createServiceRoleClient();

  const [
    subscriptionsRes,
    summaryRes,
    purchasesRes,
    consumptionsRes,
    creditGrantsRes,
    manualGrantsRes,
    promoRedemptionsRes,
  ] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id,user_id,plan,status,current_period_end,amount,currency,created_at,metadata")
      .order("created_at", { ascending: false })
      .limit(1500),
    supabase.from("owner_monetization_summary").select("*").maybeSingle(),
    supabase
      .from("stripe_oneoff_purchases")
      .select("id,stripe_session_id,company_id,buyer_user_id,price_id,product_key,amount,currency,credits_granted,created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("profile_view_consumptions")
      .select("id,company_id,viewer_user_id,candidate_id,verification_id,credits_spent,source,created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("credit_grants")
      .select("id,user_id,credits,source_type,is_active,created_at,metadata")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("manual_grants")
      .select("id,user_id,grant_type,grant_value,status,created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("promo_code_redemptions")
      .select("id,user_id,status,redeemed_at,applied_plan")
      .order("redeemed_at", { ascending: false })
      .limit(500),
  ]);

  const rows = Array.isArray(subscriptionsRes.data) ? subscriptionsRes.data : [];
  const purchases = Array.isArray(purchasesRes.data) ? purchasesRes.data : [];
  const consumptions = Array.isArray(consumptionsRes.data) ? consumptionsRes.data : [];
  const creditGrants = Array.isArray(creditGrantsRes.data) ? creditGrantsRes.data : [];
  const manualGrants = Array.isArray(manualGrantsRes.data) ? manualGrantsRes.data : [];
  const promoRedemptions = Array.isArray(promoRedemptionsRes.data) ? promoRedemptionsRes.data : [];
  const summary = (summaryRes.data as any) || null;

  const activeRows = rows.filter((r: any) => {
    const s = String(r.status || "").toLowerCase();
    return s === "active" || s === "trialing";
  });
  const canceledRows = rows.filter((r: any) => String(r.status || "").toLowerCase() === "canceled");
  const pastDueRows = rows.filter((r: any) => String(r.status || "").toLowerCase() === "past_due");
  const newThis30d = rows.filter((r: any) => {
    if (!r.created_at) return false;
    return new Date(r.created_at).getTime() >= Date.now() - 30 * 24 * 60 * 60 * 1000;
  }).length;

  const mrrFromAmount = activeRows.reduce((acc: number, row: any) => acc + Number(row.amount || 0), 0) / 100;
  const arpu = activeRows.length > 0 ? mrrFromAmount / activeRows.length : 0;
  const churnRate =
    activeRows.length + canceledRows.length > 0
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

  const totalCreditsGranted = Number(summary?.total_credits_granted ?? creditGrants.reduce((acc: number, row: any) => acc + Number(row.credits || 0), 0));
  const totalUnlocks = Number(summary?.total_unlocks ?? consumptions.length);
  const totalCreditsConsumed = Number(summary?.total_credits_consumed ?? consumptions.reduce((acc: number, row: any) => acc + Number(row.credits_spent || 0), 0));
  const totalOneoffRevenue = Number(summary?.total_oneoff_revenue ?? purchases.reduce((acc: number, row: any) => acc + Number(row.amount || 0), 0));
  const totalPackSales = Number(summary?.total_pack_sales ?? purchases.filter((row: any) => String(row.product_key || "") === "company_pack_5").length);
  const totalSingleUnlockSales = Number(summary?.total_single_unlock_sales ?? purchases.filter((row: any) => String(row.product_key || "") === "company_single_cv").length);
  const companiesConsumingCredits = Number(summary?.companies_consuming_credits ?? new Set(consumptions.map((row: any) => String(row.company_id || ""))).size);
  const creditsRemainingGlobal = Number(summary?.credits_remaining_global ?? Math.max(0, totalCreditsGranted - totalCreditsConsumed));
  const activeCreditGrants = creditGrants.filter((row: any) => row.is_active !== false).length;
  const activeManualGrants = manualGrants.filter((row: any) => String(row.status || "").toLowerCase() === "active").length;
  const totalPromoRedemptions = Number(summary?.total_promo_redemptions ?? promoRedemptions.length);
  const creditSourceAvailable = !creditGrantsRes.error;
  const consumptionSourceAvailable = !consumptionsRes.error && !summaryRes.error;
  const purchaseSourceAvailable = !purchasesRes.error && !summaryRes.error;
  const hasOverspendWarning = totalCreditsConsumed > totalCreditsGranted;
  const hasConsumptionWithoutPurchaseWarning = totalCreditsConsumed > 0 && purchases.length === 0;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Monetización</h1>
        <p className="mt-1 text-sm text-slate-600">
          Control ejecutivo de ingresos recurrentes y monetización puntual. Se separan claramente las suscripciones locales, las compras one-off persistidas y el consumo real de visualizaciones registrado.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700">Suscripción recurrente</span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800">Compras puntuales</span>
          <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 font-semibold text-sky-800">Consumo de visualizaciones</span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">Stripe LIVE: reconciliación parcial</span>
        </div>
        <p className="mt-2 inline-flex items-center gap-2 text-xs text-slate-500">
          Definiciones de monetización
          <OwnerTooltip text="MRR = suma de suscripciones activas o en prueba. Compras puntuales = ventas registradas al completar checkout. Consumo = aperturas completas de perfil que gastan crédito." />
        </p>
      </section>

      {(hasOverspendWarning || hasConsumptionWithoutPurchaseWarning) ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
          <p className="font-semibold">Reconciliación pendiente</p>
          {hasOverspendWarning ? (
            <p className="mt-1">Se han consumido más créditos de los concedidos en la fuente auditada actual. Revisa grants legacy o consumos previos a este log.</p>
          ) : null}
          {hasConsumptionWithoutPurchaseWarning ? (
            <p className="mt-1">Hay consumo registrado sin compra puntual visible en la trazabilidad actual. Puede deberse a grants manuales, promociones o compras anteriores no persistidas.</p>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
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
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">ARPU derivado</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{eur(arpu)}</p>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unlocks realizados</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{consumptionSourceAvailable ? totalUnlocks : "No disp."}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Créditos consumidos</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{consumptionSourceAvailable ? totalCreditsConsumed : "No disp."}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Empresas que consumen</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{consumptionSourceAvailable ? companiesConsumingCredits : "No disp."}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ventas single unlock</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{purchaseSourceAvailable ? totalSingleUnlockSales : "No disp."}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ventas packs</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{purchaseSourceAvailable ? totalPackSales : "No disp."}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ingresos one-off</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{purchaseSourceAvailable ? eurFromCents(totalOneoffRevenue) : "No disp."}</p>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Créditos concedidos</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{creditSourceAvailable ? totalCreditsGranted : "No disp."}</p>
          <p className="mt-1 text-xs text-slate-500">Fuente auditada desde `credit_grants`.</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Créditos restantes globales</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{consumptionSourceAvailable ? creditsRemainingGlobal : "No disp."}</p>
          <p className="mt-1 text-xs text-slate-500">Concedidos menos consumidos en la fuente auditada actual.</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Grants de crédito activos</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{creditSourceAvailable ? activeCreditGrants : "No disp."}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Manual grants activos</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{!manualGrantsRes.error ? activeManualGrants : "No disp."}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Promos redimidas</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{!promoRedemptionsRes.error ? totalPromoRedemptions : "No disp."}</p>
        </article>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Consumo puntual y conciliación</h2>
        <p className="mt-1 text-sm text-slate-600">
          Esta sección separa compras puntuales y visualizaciones consumidas. La trazabilidad ya permite auditar ingresos y gasto de créditos recientes.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Última compra one-off</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{fmtDate(summary?.last_oneoff_purchase_at || purchases[0]?.created_at)}</p>
            <p className="mt-1 text-xs text-slate-500">Incluye compras de visualización individual y packs de visualizaciones.</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado de conciliación</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {hasOverspendWarning || hasConsumptionWithoutPurchaseWarning ? "Revisión recomendada" : "Coherencia básica OK"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              La conciliación es fiable para compras y consumos nuevos. Los datos legacy anteriores a este log pueden no estar completos.
            </p>
          </article>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Compras puntuales recientes</h2>
        <p className="mt-1 text-sm text-slate-600">Histórico canónico de sesiones one-off completadas en Stripe.</p>
        {purchases.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            Aún no se han registrado compras puntuales en esta fuente.
          </div>
        ) : (
          <div className="mt-4 overflow-auto">
            <table className="min-w-[980px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">Producto</th>
                  <th className="px-3 py-3">Importe</th>
                  <th className="px-3 py-3">Créditos</th>
                  <th className="px-3 py-3">Empresa</th>
                  <th className="px-3 py-3">Buyer</th>
                  <th className="px-3 py-3">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((row: any) => (
                  <tr key={row.id} className="border-b border-slate-100 text-slate-800">
                    <td className="px-3 py-3 font-semibold text-slate-900">{productLabel(row.product_key)}</td>
                    <td className="px-3 py-3">{eurFromCents(Number(row.amount || 0))}</td>
                    <td className="px-3 py-3">{row.credits_granted ?? "—"}</td>
                    <td className="px-3 py-3">{row.company_id || "—"}</td>
                    <td className="px-3 py-3">{row.buyer_user_id || "—"}</td>
                    <td className="px-3 py-3">{fmtDate(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Unlocks recientes</h2>
        <p className="mt-1 text-sm text-slate-600">Consumo real de visualizaciones al abrir perfil completo.</p>
        {consumptions.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            Todavía no hay visualizaciones consumidas registradas.
          </div>
        ) : (
          <div className="mt-4 overflow-auto">
            <table className="min-w-[980px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">Fuente</th>
                  <th className="px-3 py-3">Créditos</th>
                  <th className="px-3 py-3">Empresa</th>
                  <th className="px-3 py-3">Viewer</th>
                  <th className="px-3 py-3">Candidato</th>
                  <th className="px-3 py-3">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {consumptions.map((row: any) => (
                  <tr key={row.id} className="border-b border-slate-100 text-slate-800">
                    <td className="px-3 py-3 font-semibold text-slate-900">{row.source || "—"}</td>
                    <td className="px-3 py-3">{row.credits_spent ?? 0}</td>
                    <td className="px-3 py-3">{row.company_id || "—"}</td>
                    <td className="px-3 py-3">{row.viewer_user_id || "—"}</td>
                    <td className="px-3 py-3">{row.candidate_id || "—"}</td>
                    <td className="px-3 py-3">{fmtDate(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Resumen por plan</h2>
        <p className="mt-1 text-sm text-slate-600">Distribución activa y aportación mensual estimada por plan.</p>
        {sortedPlans.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            Aún no hay actividad suficiente de suscripción para construir un resumen por plan.
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
            Todavía no hay suscripciones registradas para mostrar actividad reciente.
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
