import Link from "next/link";

export const dynamic = "force-dynamic";

export default function CompanyBillingPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-extrabold text-slate-900">Facturación</h1>
      <p className="mt-2 text-slate-600">
        Estado del plan, upgrades y portal de facturación (Stripe) cuando esté LIVE.
      </p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="text-sm font-bold text-slate-900">Acciones</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/company/upgrade" className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:opacity-90">
            Ver planes / Upgrade
          </Link>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Nota: el portal Stripe LIVE se activará en el cierre final de monetización.
        </p>
      </div>
    </div>
  );
}
