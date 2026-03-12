import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

function jobStatusLabel(raw: unknown) {
  const s = String(raw || "").toLowerCase();
  if (!s) return "Pendiente de clasificación";
  if (s === "failed" || s === "error") return "Fallido";
  if (s === "done" || s === "completed" || s === "success") return "Completado";
  if (s.includes("pending") || s === "queued") return "Pendiente";
  if (s.includes("processing") || s === "running") return "En proceso";
  if (s.includes("retry")) return "Reintento";
  return s.replaceAll("_", " ");
}

export default async function OwnerAiOpsPage() {
  const supabase = await createClient();

  const { data: jobs } = await supabase
    .from("cv_parse_jobs")
    .select("id,status,created_at,started_at,finished_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(400);

  const rows = Array.isArray(jobs) ? jobs : [];
  const statusCount = rows.reduce<Record<string, number>>((acc, row: any) => {
    const key = String(row.status || "pending_review").toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  let totalDurationMs = 0;
  let measured = 0;
  for (const row of rows as any[]) {
    if (!row.started_at || !row.finished_at) continue;
    const ms = new Date(row.finished_at).getTime() - new Date(row.started_at).getTime();
    if (ms > 0) {
      totalDurationMs += ms;
      measured += 1;
    }
  }
  const avgSeconds = measured ? Math.round(totalDurationMs / measured / 1000) : 0;
  const pendingCount = (statusCount.queued || 0) + (statusCount.pending || 0) + (statusCount.processing || 0) + (statusCount.running || 0);
  const failedCount = (statusCount.failed || 0) + (statusCount.error || 0);
  const retryCount = statusCount.retrying || 0;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Procesamiento automático</h1>
        <p className="mt-2 text-sm text-slate-600">
          Módulo técnico owner para monitorizar jobs internos de parsing y salud operativa de automatizaciones.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Jobs procesados</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{rows.length}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Pendientes</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{pendingCount}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Fallidos</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{failedCount}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Retries</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{retryCount}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Tiempo medio</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{avgSeconds ? `${avgSeconds}s` : "—"}</p>
        </article>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Últimos jobs</h2>
        {rows.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            No hay jobs disponibles todavía para mostrar actividad.
          </div>
        ) : (
          <div className="mt-4 overflow-auto">
            <table className="min-w-[960px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">ID</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Inicio</th>
                  <th className="px-3 py-3">Fin</th>
                  <th className="px-3 py-3">Duración</th>
                  <th className="px-3 py-3">Creado</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 100).map((row: any) => {
                  const duration = row.started_at && row.finished_at
                    ? Math.max(0, Math.round((new Date(row.finished_at).getTime() - new Date(row.started_at).getTime()) / 1000))
                    : null;
                  return (
                    <tr key={row.id} className="border-b border-slate-100 text-slate-800">
                      <td className="px-3 py-3 font-mono text-xs">{row.id}</td>
                      <td className="px-3 py-3">{jobStatusLabel(row.status)}</td>
                      <td className="px-3 py-3">{row.started_at ? new Date(row.started_at).toLocaleString("es-ES") : "—"}</td>
                      <td className="px-3 py-3">{row.finished_at ? new Date(row.finished_at).toLocaleString("es-ES") : "—"}</td>
                      <td className="px-3 py-3">{duration != null ? `${duration}s` : "—"}</td>
                      <td className="px-3 py-3">{row.created_at ? new Date(row.created_at).toLocaleString("es-ES") : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
