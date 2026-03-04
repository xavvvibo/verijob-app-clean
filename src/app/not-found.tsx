import Link from "next/link";
import ReportIssueButton from "@/components/admin/ReportIssueButton";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 p-8">
        <div className="text-xs font-semibold text-slate-500">VERIJOB</div>
        <h1 className="mt-2 text-3xl font-extrabold text-slate-900">No encontramos esa página</h1>
        <p className="mt-2 text-slate-600">
          Puede ser un enlace antiguo o una ruta mal enlazada. Vuelve al dashboard o a la web.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90" href="/dashboard">
            Ir al dashboard
          </Link>
          <a className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:opacity-90" href="https://verijob.es">
            Ver la web
          </a>
        </div>

        <ReportIssueButton httpStatus={404} />
      </div>
    </div>
  );
}
