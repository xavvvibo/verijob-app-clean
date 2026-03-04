import Link from "next/link";

export const dynamic = "force-dynamic";

type Item = {
  id: string;
  created_at: string;
  severity: string;
  http_status: number | null;
  error_code: string | null;
  path: string | null;
  message_short: string;
  resolved_at: string | null;
};

async function getIssues(): Promise<Item[]> {
  const res = await fetch("https://app.verijob.es/api/admin/issues", { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  return (data?.items ?? []) as Item[];
}

export default async function OwnerIssuesPage() {
  const items = await getIssues();

  return (
    <div className="max-w-[1200px]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Issue Desk</h1>
          <p className="mt-1 text-sm text-slate-600">Incidencias reportadas (404/500) y entradas manuales.</p>
        </div>

        <Link
          href="/owner/issues/new"
          className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Nueva incidencia
        </Link>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs font-semibold text-slate-500 bg-slate-50 border-b border-slate-200">
          <div className="col-span-2">Fecha</div>
          <div className="col-span-1">Sev</div>
          <div className="col-span-1">HTTP</div>
          <div className="col-span-2">Code</div>
          <div className="col-span-4">Ruta</div>
          <div className="col-span-2">Estado</div>
        </div>

        {items.length ? items.map((it) => (
          <div key={it.id} className="grid grid-cols-12 gap-2 px-4 py-3 text-sm border-b border-slate-100">
            <div className="col-span-2 text-slate-700">{new Date(it.created_at).toLocaleString("es-ES")}</div>
            <div className="col-span-1 font-semibold text-slate-900">{it.severity}</div>
            <div className="col-span-1 text-slate-700">{it.http_status ?? "-"}</div>
            <div className="col-span-2 text-slate-700">{it.error_code ?? "-"}</div>
            <div className="col-span-4 font-mono text-xs text-slate-700 truncate">{it.path ?? "-"}</div>
            <div className="col-span-2">
              {it.resolved_at ? (
                <span className="inline-flex rounded-full bg-green-50 text-green-700 border border-green-100 px-2 py-1 text-xs font-semibold">resuelto</span>
              ) : (
                <span className="inline-flex rounded-full bg-amber-50 text-amber-700 border border-amber-100 px-2 py-1 text-xs font-semibold">abierto</span>
              )}
            </div>
            <div className="col-span-12 -mt-1 text-slate-600">{it.message_short}</div>
          </div>
        )) : (
          <div className="px-4 py-10 text-sm text-slate-600">No hay incidencias todavía.</div>
        )}
      </div>
    </div>
  );
}
