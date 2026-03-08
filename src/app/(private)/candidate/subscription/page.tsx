import Link from "next/link";

export const dynamic = "force-dynamic";

export default function CandidateSubscriptionPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Subscription</h1>
      <p className="text-sm text-gray-600">
        Consulta tu plan actual y las opciones disponibles para ampliar funcionalidades.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Plan actual</h2>
          <p className="mt-2 text-sm text-gray-700">Candidate PRO</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-600">
            <li>Perfil verificable compartible</li>
            <li>Gestión de evidencias y verificaciones</li>
            <li>Dashboard de credibilidad</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Facturación y upgrade</h2>
          <p className="mt-2 text-sm text-gray-600">
            Si necesitas cambiar de plan o gestionar facturación, usa tu panel de billing.
          </p>
          <div className="mt-4 flex gap-2">
            <Link
              href="/candidate/help"
              className="inline-flex rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            >
              Contactar soporte
            </Link>
            <Link
              href="/precios"
              className="inline-flex rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Ver upgrade
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
