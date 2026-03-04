import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function Card({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="text-xs font-bold text-slate-500 uppercase">{title}</div>
      <div className="mt-2 text-2xl font-extrabold text-slate-900">{value}</div>
      {subtitle ? <div className="mt-1 text-sm text-slate-600">{subtitle}</div> : null}
    </div>
  );
}

export default function CompanyDashboardPage() {
  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Trust & Risk Command Center</h1>
          <p className="mt-2 text-slate-600">
            Verificación operativa para contratación: estado, cola, reutilización y trazabilidad.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/company/requests" className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:opacity-90">
            Ver solicitudes
          </Link>
          <Link href="/company/reuse" className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-900 hover:bg-slate-50">
            Reutilizar
          </Link>
          <Link href="/company/candidates" className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-900 hover:bg-slate-50">
            Abrir candidato
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Card title="Pendientes" value="—" subtitle="Solicitudes activas" />
        <Card title="Verificadas (30d)" value="—" subtitle="Producción reciente" />
        <Card title="Reuse rate" value="—" subtitle="Ahorro de tiempo" />
        <Card title="Riesgo" value="—" subtitle="Señales / incidencias" />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="text-sm font-extrabold text-slate-900">Cola operativa</div>
          <p className="mt-2 text-sm text-slate-600">
            Vista rápida de lo que requiere acción hoy. (B: lo conectamos a datos reales)
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/company/requests" className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:opacity-90">
              Gestionar cola
            </Link>
            <Link href="/company/team" className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-900 hover:bg-slate-50">
              Equipo & permisos
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="text-sm font-extrabold text-slate-900">Reutilización</div>
          <p className="mt-2 text-sm text-slate-600">
            Importa verificaciones previas con consentimiento y reduce fricción.
          </p>
          <div className="mt-4">
            <Link href="/company/reuse" className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:opacity-90">
              Reutilizar ahora
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="text-sm font-extrabold text-slate-900">Plan & facturación</div>
          <p className="mt-2 text-sm text-slate-600">
            Créditos, límites de usuarios y upgrades. (Stripe LIVE en cierre final)
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/company/billing" className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-900 hover:bg-slate-50">
              Ver facturación
            </Link>
            <Link href="/company/settings" className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-900 hover:bg-slate-50">
              Ajustes
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="text-sm font-extrabold text-slate-900">Siguiente (B)</div>
        <ul className="mt-3 list-disc pl-5 text-sm text-slate-700 space-y-2">
          <li>Conectar KPIs reales (requests/verifications/evidences/reuse) con endpoint company.</li>
          <li>Tabla “Cola” con filtros: estado, fecha, candidato, puesto.</li>
          <li>Panel “Riesgo”: incidencias relevantes + tiempos de respuesta.</li>
        </ul>
      </div>
    </div>
  );
}
