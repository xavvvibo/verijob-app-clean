export const dynamic = "force-dynamic";

export default function OwnerOverviewPage() {
  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-extrabold text-slate-900">Owner Overview</h1>
      <p className="mt-2 text-slate-600">
        Command Center. Aquí consolidaremos métricas SaaS, salud del sistema, embudos y alertas operativas.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-bold text-slate-500 uppercase">Activación</div>
          <div className="mt-2 text-lg font-extrabold text-slate-900">Usuarios / Onboarding</div>
          <p className="mt-2 text-sm text-slate-600">Signup → onboarding_completed → first action.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-bold text-slate-500 uppercase">Uso</div>
          <div className="mt-2 text-lg font-extrabold text-slate-900">Verificaciones / Evidencias</div>
          <p className="mt-2 text-sm text-slate-600">Creación, finalización, revocaciones, reuse rate.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-bold text-slate-500 uppercase">Riesgo</div>
          <div className="mt-2 text-lg font-extrabold text-slate-900">Errores / Incidencias</div>
          <p className="mt-2 text-sm text-slate-600">404/500, endpoints top, tendencias y triage.</p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="text-sm font-extrabold text-slate-900">Siguiente (B)</div>
        <ul className="mt-3 list-disc pl-5 text-sm text-slate-700 space-y-2">
          <li>Endpoint owner-only para KPIs agregados (users, verifications, evidences, reuse).</li>
          <li>Issue Desk: captura automática de 404/500 + alta manual + estados.</li>
          <li>Marketing & Growth: embudo GA4 con cohorts.</li>
        </ul>
      </div>
    </div>
  );
}
