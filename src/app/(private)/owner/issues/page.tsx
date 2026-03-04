export const dynamic = "force-dynamic";
export default function OwnerIssuesPage() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-extrabold text-slate-900">Issue Desk</h1>
      <p className="mt-2 text-slate-600">
        Registro de incidencias (404/500/400), mini descripción, severidad, estado y trazabilidad.
      </p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="text-sm font-extrabold text-slate-900">Pendiente (B)</div>
        <ul className="mt-3 list-disc pl-5 text-sm text-slate-700 space-y-2">
          <li>Alta manual (form) + listado.</li>
          <li>Captura automática desde ErrorBoundary y 404 handler.</li>
          <li>Estados: open / triage / in_progress / resolved / wontfix.</li>
        </ul>
      </div>
    </div>
  );
}
