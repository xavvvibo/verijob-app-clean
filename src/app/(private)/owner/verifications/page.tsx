import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

function normalizeStatus(raw: unknown) {
  const s = String(raw || "").toLowerCase();
  if (s === "verified" || s === "approved") return "Verificada";
  if (s === "rejected") return "Rechazada";
  if (s.includes("pending") || s.includes("request")) return "Pendiente";
  return s || "Sin estado";
}

export default async function OwnerVerificationsPage() {
  const supabase = await createClient();

  const { data: requests } = await supabase
    .from("verification_requests")
    .select("id,requested_by,company_id,status,verification_channel,requested_at,resolved_at,company_name_target")
    .order("requested_at", { ascending: false })
    .limit(200);

  const rows = Array.isArray(requests) ? requests : [];

  const userIds = Array.from(new Set(rows.map((r: any) => r.requested_by).filter(Boolean)));
  const companyIds = Array.from(new Set(rows.map((r: any) => r.company_id).filter(Boolean)));

  const [profilesRes, companiesRes, employmentRes] = await Promise.all([
    userIds.length ? supabase.from("profiles").select("id,full_name,email").in("id", userIds) : Promise.resolve({ data: [] } as any),
    companyIds.length ? supabase.from("companies").select("id,name").in("id", companyIds) : Promise.resolve({ data: [] } as any),
    rows.length ? supabase.from("employment_records").select("id,position,company_name_freeform,last_verification_request_id").in("last_verification_request_id", rows.map((r: any) => r.id)) : Promise.resolve({ data: [] } as any),
  ]);

  const profiles = new Map((Array.isArray(profilesRes.data) ? profilesRes.data : []).map((p: any) => [String(p.id), p]));
  const companies = new Map((Array.isArray(companiesRes.data) ? companiesRes.data : []).map((c: any) => [String(c.id), c]));
  const employmentByRequest = new Map((Array.isArray(employmentRes.data) ? employmentRes.data : []).map((e: any) => [String(e.last_verification_request_id), e]));

  const byStatus = rows.reduce<Record<string, number>>((acc, row: any) => {
    const key = normalizeStatus(row.status);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Verificaciones</h1>
        <p className="mt-2 text-sm text-slate-600">
          Visión global de solicitudes por candidato, empresa, método y estado de resolución.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {Object.keys(byStatus).length === 0 ? <span className="text-slate-500">Sin verificaciones registradas.</span> : null}
          {Object.entries(byStatus).map(([status, count]) => (
            <span key={status} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700">
              {status}: {count}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-600">
            Todavía no hay solicitudes de verificación para mostrar.
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-[1100px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">Candidato</th>
                  <th className="px-3 py-3">Empresa</th>
                  <th className="px-3 py-3">Experiencia</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Método</th>
                  <th className="px-3 py-3">Solicitada</th>
                  <th className="px-3 py-3">Resuelta</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any) => {
                  const profile = profiles.get(String(row.requested_by || "")) as any;
                  const company = companies.get(String(row.company_id || "")) as any;
                  const employment = employmentByRequest.get(String(row.id)) as any;
                  return (
                    <tr key={row.id} className="border-b border-slate-100 text-slate-800">
                      <td className="px-3 py-3">
                        <div className="font-semibold text-slate-900">{profile?.full_name || profile?.email || "Candidato"}</div>
                        <div className="text-xs text-slate-500">{profile?.email || "—"}</div>
                      </td>
                      <td className="px-3 py-3">{company?.name || row.company_name_target || "Empresa externa"}</td>
                      <td className="px-3 py-3">{employment?.position || "Puesto no indicado"}</td>
                      <td className="px-3 py-3">{normalizeStatus(row.status)}</td>
                      <td className="px-3 py-3">{row.verification_channel || "email"}</td>
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
