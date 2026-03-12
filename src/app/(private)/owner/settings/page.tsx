import Link from "next/link";

export const dynamic = "force-dynamic";

const flags = [
  { key: "owner_growth_sync", label: "Sincronización de crecimiento", value: "Activo" },
  { key: "owner_issue_desk", label: "Centro de incidencias", value: "Activo" },
  { key: "owner_marketing_promos", label: "Promociones de marketing", value: "Activo" },
  { key: "owner_company_profile", label: "Módulo perfil empresa", value: "Activo" },
];

export default function OwnerSettingsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Configuración</h1>
        <p className="mt-2 text-sm text-slate-600">
          Configuración operativa owner para gobernanza, seguridad y control del centro de mando.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Funciones experimentales (v1)</h2>
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
          <h2 className="text-lg font-semibold text-slate-900">Accesos de administración</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <Link href="/owner/issues" className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-800 hover:bg-slate-50">
              Revisar incidencias
            </Link>
            <Link href="/owner/growth" className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-800 hover:bg-slate-50">
              Configurar campañas de growth
            </Link>
            <Link href="/owner/marketing" className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-800 hover:bg-slate-50">
              Gestionar promociones y grants
            </Link>
            <Link href="/owner/monetization" className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-800 hover:bg-slate-50">
              Revisar monetización y Stripe LIVE
            </Link>
          </div>
        </article>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Seguridad y operación</h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-700">
          <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">Los cambios sensibles deben ejecutarse vía API owner con validación de rol.</li>
          <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">Evitar operaciones manuales en producción fuera de panel para mantener trazabilidad.</li>
          <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">Mantener monitoreo de errores y reintentos desde Centro de incidencias y Procesamiento automático.</li>
        </ul>
      </section>
    </div>
  );
}
