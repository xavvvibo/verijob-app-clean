import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";

export const dynamic = "force-dynamic";

const flags = [
  { key: "owner_growth_sync", label: "Growth y campañas", value: "Operativo" },
  { key: "owner_issue_desk", label: "Centro de incidencias", value: "Operativo" },
  { key: "owner_marketing_promos", label: "Promociones y grants", value: "Operativo" },
  { key: "owner_company_profile", label: "Panel empresa", value: "Operativo" },
];

function integrationClass(connected: boolean) {
  return connected
    ? "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"
    : "rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700";
}

export default async function OwnerSettingsPage() {
  const sessionClient = await createServerSupabaseClient();
  const { data: auth } = await sessionClient.auth.getUser();
  if (!auth?.user) redirect("/login?next=/owner/settings");

  const { data: ownerProfile } = await sessionClient.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  const ownerRole = String(ownerProfile?.role || "").toLowerCase();
  if (!["owner", "admin"].includes(ownerRole)) redirect("/dashboard?forbidden=1&from=owner");

  const admin = createServiceRoleClient();
  const [issuesRes, jobsRes, actionsRes] = await Promise.all([
    admin.from("issue_reports").select("id", { count: "exact", head: true }),
    admin.from("cv_parse_jobs").select("id", { count: "exact", head: true }),
    admin.from("owner_actions").select("id", { count: "exact", head: true }),
  ]);

  const operations = [
    { label: "Incidencias registradas", value: issuesRes.error ? "Fuente no disponible" : String(issuesRes.count || 0) },
    { label: "Jobs de parsing", value: jobsRes.error ? "Infra pendiente" : String(jobsRes.count || 0) },
    { label: "Acciones owner trazadas", value: actionsRes.error ? "Sin fuente" : String(actionsRes.count || 0) },
  ];

  const integrations = [
    { label: "Supabase base de datos", connected: true, detail: "Fuente principal de perfiles, verificaciones y owner data." },
    { label: "Stripe LIVE", connected: Boolean(process.env.STRIPE_SECRET_KEY), detail: "Checkout, portal y monetización recurrente." },
    { label: "Resend / email transaccional", connected: Boolean(process.env.RESEND_API_KEY), detail: "Emails operativos y flujos candidato-empresa." },
    { label: "OpenAI parsing", connected: Boolean(process.env.OPENAI_API_KEY), detail: "Procesamiento de CV y automatizaciones dependientes." },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Configuración</h1>
        <p className="mt-2 text-sm text-slate-600">
          Centro operativo owner para guardrails, integraciones, módulos activos y controles sensibles.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {operations.map((item) => (
          <article key={item.label} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Módulos activos</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            {flags.map((flag) => (
              <li key={flag.key} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <span>{flag.label}</span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">{flag.value}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Integraciones y fuentes</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-700">
            {integrations.map((integration) => (
              <li key={integration.label} className="rounded-lg border border-slate-200 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-900">{integration.label}</span>
                  <span className={integrationClass(integration.connected)}>{integration.connected ? "Conectado" : "Pendiente"}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{integration.detail}</p>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Accesos de administración</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <Link href="/owner/overview" className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-800 hover:bg-slate-50">
              Abrir overview owner
            </Link>
            <Link href="/owner/issues" className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-800 hover:bg-slate-50">
              Revisar incidencias
            </Link>
            <Link href="/owner/growth" className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-800 hover:bg-slate-50">
              Gestionar campañas de growth
            </Link>
            <Link href="/owner/marketing" className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-800 hover:bg-slate-50">
              Gestionar promociones y grants
            </Link>
            <Link href="/owner/monetization" className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-800 hover:bg-slate-50">
              Revisar monetización y reconciliación
            </Link>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Guardrails de seguridad</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">Las operaciones sensibles deben ejecutarse desde APIs owner con validación de rol y trazabilidad.</li>
            <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">Si un módulo muestra “fuente no disponible”, el valor no equivale a cero: indica integración pendiente o tabla no accesible.</li>
            <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">Evita cambios manuales en producción fuera de panel para no romper auditoría ni consistencia operativa.</li>
          </ul>
        </article>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Gobernanza y operación</h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-700">
          <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">Los módulos owner distinguen entre cero real, sin datos, integración pendiente y error de carga para evitar lecturas falsas.</li>
          <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">Usa Incidencias para seguimiento manual y Procesamiento automático para jobs de parsing o reintentos técnicos.</li>
          <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">Growth, Marketing y Monetización están conectados al backend actual; si una fuente externa falta, el panel debe degradar de forma honesta.</li>
        </ul>
      </section>
    </div>
  );
}
