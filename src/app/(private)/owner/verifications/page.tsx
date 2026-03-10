import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

function normalizeStatus(raw: unknown) {
  const s = String(raw || "").toLowerCase();
  if (s === "verified" || s === "approved") return "verificada";
  if (s === "rejected") return "rechazada";
  if (s.includes("pending") || s.includes("request")) return "pendiente";
  return s || "sin_estado";
}

function statusLabel(v: string) {
  if (v === "verificada") return "Verificada";
  if (v === "rechazada") return "Rechazada";
  if (v === "pendiente") return "Pendiente";
  if (v === "sin_estado") return "Sin estado";
  return v;
}

export default async function OwnerVerificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const statusFilter = String(sp.status || "all").toLowerCase();
  const methodFilter = String(sp.method || "all").toLowerCase();
  const rangeFilter = String(sp.range || "all").toLowerCase();

  const now = Date.now();
  const fromMs =
    rangeFilter === "7d"
      ? now - 7 * 24 * 60 * 60 * 1000
      : rangeFilter === "30d"
        ? now - 30 * 24 * 60 * 60 * 1000
        : null;

  const supabase = await createClient();

  const { data: requests } = await supabase
    .from("verification_requests")
    .select("id,requested_by,company_id,status,verification_channel,requested_at,resolved_at,company_name_target")
    .order("requested_at", { ascending: false })
    .limit(300);

  const rows = Array.isArray(requests) ? requests : [];

  const userIds = Array.from(new Set(rows.map((r: any) => r.requested_by).filter(Boolean)));
  const companyIds = Array.from(new Set(rows.map((r: any) => r.company_id).filter(Boolean)));

  const [profilesRes, companiesRes, employmentRes] = await Promise.all([
    userIds.length
      ? supabase.from("profiles").select("id,full_name,email").in("id", userIds)
      : Promise.resolve({ data: [] } as any),
    companyIds.length
      ? supabase.from("companies").select("id,name").in("id", companyIds)
      : Promise.resolve({ data: [] } as any),
    rows.length
      ? supabase
          .from("employment_records")
          .select("id,position,company_name_freeform,last_verification_request_id,start_date,end_date")
          .in("last_verification_request_id", rows.map((r: any) => r.id))
      : Promise.resolve({ data: [] } as any),
  ]);

  const profiles = new Map((Array.isArray(profilesRes.data) ? profilesRes.data : []).map((p: any) => [String(p.id), p]));
  const companies = new Map((Array.isArray(companiesRes.data) ? companiesRes.data : []).map((c: any) => [String(c.id), c]));
  const employmentByRequest = new Map((Array.isArray(employmentRes.data) ? employmentRes.data : []).map((e: any) => [String(e.last_verification_request_id), e]));

  const normalized = rows.map((row: any) => {
    const status = normalizeStatus(row.status);
    const method = String(row.verification_channel || "email").toLowerCase();
    const requestedAt = row.requested_at ? new Date(row.requested_at).getTime() : null;
    return { row, status, method, requestedAt };
  });

  const filtered = normalized.filter((entry) => {
    if (statusFilter !== "all" && entry.status !== statusFilter) return false;
    if (methodFilter !== "all" && entry.method !== methodFilter) return false;
    if (fromMs && (!entry.requestedAt || entry.requestedAt < fromMs)) return false;
    return true;
  });

  const byStatus = normalized.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.status] = (acc[entry.status] || 0) + 1;
    return acc;
  }, {});

  const methods = Array.from(new Set(normalized.map((x) => x.method))).filter(Boolean);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Verificaciones</h1>
        <p className="mt-1 text-sm text-slate-600">
          Visión global de solicitudes: estado, método, empresa implicada y experiencia asociada.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {Object.keys(byStatus).length === 0 ? <span className="text-slate-500">Sin verificaciones registradas.</span> : null}
          {Object.entries(byStatus).map(([status, count]) => (
            <span key={status} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700">
              {statusLabel(status)}: {count}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <form className="grid gap-3 md:grid-cols-4">
          <select name="status" defaultValue={statusFilter} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">Estado: todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="verificada">Verificada</option>
            <option value="rechazada">Rechazada</option>
            <option value="sin_estado">Sin estado</option>
          </select>
          <select name="method" defaultValue={methodFilter} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">Método: todos</option>
            {methods.map((method) => (
              <option key={method} value={method}>{method}</option>
            ))}
          </select>
          <select name="range" defaultValue={rangeFilter} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">Fecha: todo</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
          </select>
          <div className="flex gap-2">
            <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Aplicar</button>
            <Link href="/owner/verifications" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
              Limpiar
            </Link>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-600">
            No hay verificaciones para los filtros aplicados.
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-[1180px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">Candidato</th>
                  <th className="px-3 py-3">Empresa</th>
                  <th className="px-3 py-3">Experiencia</th>
                  <th className="px-3 py-3">Periodo</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Método</th>
                  <th className="px-3 py-3">Solicitada</th>
                  <th className="px-3 py-3">Resuelta</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => {
                  const row: any = entry.row;
                  const profile = profiles.get(String(row.requested_by || "")) as any;
                  const company = companies.get(String(row.company_id || "")) as any;
                  const employment = employmentByRequest.get(String(row.id)) as any;
                  const period = employment?.start_date
                    ? `${new Date(employment.start_date).toLocaleDateString("es-ES")} - ${employment?.end_date ? new Date(employment.end_date).toLocaleDateString("es-ES") : "Actual"}`
                    : "—";

                  return (
                    <tr key={row.id} className="border-b border-slate-100 text-slate-800">
                      <td className="px-3 py-3">
                        <div className="font-semibold text-slate-900">{profile?.full_name || profile?.email || "Candidato"}</div>
                        <div className="text-xs text-slate-500">{profile?.email || "—"}</div>
                      </td>
                      <td className="px-3 py-3">{company?.name || row.company_name_target || "Empresa externa"}</td>
                      <td className="px-3 py-3">{employment?.position || "Puesto no indicado"}</td>
                      <td className="px-3 py-3">{period}</td>
                      <td className="px-3 py-3 font-semibold text-slate-900">{statusLabel(entry.status)}</td>
                      <td className="px-3 py-3">{entry.method || "email"}</td>
                      <td className="px-3 py-3">{row.requested_at ? new Date(row.requested_at).toLocaleDateString("es-ES") : "—"}</td>
                      <td className="px-3 py-3">{row.resolved_at ? new Date(row.resolved_at).toLocaleDateString("es-ES") : "—"}</td>
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
