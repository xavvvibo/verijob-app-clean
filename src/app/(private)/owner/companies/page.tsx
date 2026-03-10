import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

function Badge({ label }: { label: string }) {
  return <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">{label}</span>;
}

export default async function OwnerCompaniesPage() {
  const supabase = await createClient();

  const { data: companies } = await supabase
    .from("companies")
    .select("id,name,created_at")
    .order("created_at", { ascending: false })
    .limit(150);

  const rows = Array.isArray(companies) ? companies : [];
  const companyIds = rows.map((r: any) => r.id).filter(Boolean);

  const [membershipsRes, requestsRes, profilesRes] = await Promise.all([
    companyIds.length
      ? supabase.from("company_members").select("company_id,user_id,role").in("company_id", companyIds)
      : Promise.resolve({ data: [] as any[] } as any),
    companyIds.length
      ? supabase.from("verification_requests").select("company_id,status,requested_at").in("company_id", companyIds)
      : Promise.resolve({ data: [] as any[] } as any),
    companyIds.length
      ? supabase.from("company_profiles").select("company_id,company_verification_status,profile_completeness_score").in("company_id", companyIds)
      : Promise.resolve({ data: [] as any[] } as any),
  ]);

  const memberships = Array.isArray(membershipsRes.data) ? membershipsRes.data : [];
  const requests = Array.isArray(requestsRes.data) ? requestsRes.data : [];
  const profiles = Array.isArray(profilesRes.data) ? profilesRes.data : [];

  const membersByCompany = new Map<string, number>();
  for (const m of memberships as any[]) {
    const key = String(m.company_id || "");
    membersByCompany.set(key, (membersByCompany.get(key) || 0) + 1);
  }

  const requestsByCompany = new Map<string, number>();
  const pendingByCompany = new Map<string, number>();
  const lastActivityByCompany = new Map<string, string>();
  for (const r of requests as any[]) {
    const key = String(r.company_id || "");
    requestsByCompany.set(key, (requestsByCompany.get(key) || 0) + 1);
    const status = String(r.status || "").toLowerCase();
    if (status.includes("request") || status.includes("pending")) {
      pendingByCompany.set(key, (pendingByCompany.get(key) || 0) + 1);
    }
    const requestedAt = String(r.requested_at || "");
    if (requestedAt) {
      const current = lastActivityByCompany.get(key);
      if (!current || new Date(requestedAt).getTime() > new Date(current).getTime()) {
        lastActivityByCompany.set(key, requestedAt);
      }
    }
  }

  const profileByCompany = new Map<string, any>();
  for (const p of profiles as any[]) {
    profileByCompany.set(String(p.company_id || ""), p);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Empresas</h1>
        <p className="mt-2 text-sm text-slate-600">
          Operativa de cuentas empresa: plan/estado, miembros, actividad de verificaciones y salud del perfil.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-600">
            No hay empresas registradas todavía. Cuando empiecen a operar en Verijob aparecerán aquí con métricas de actividad.
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-[1050px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">Empresa</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Miembros</th>
                  <th className="px-3 py-3">Solicitudes</th>
                  <th className="px-3 py-3">Pendientes</th>
                  <th className="px-3 py-3">Perfil</th>
                  <th className="px-3 py-3">Última actividad</th>
                  <th className="px-3 py-3">Creación</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any) => {
                  const id = String(row.id);
                  const profile = profileByCompany.get(id);
                  const status = String(profile?.company_verification_status || "unverified");
                  const completion = Number(profile?.profile_completeness_score || 0);
                  return (
                    <tr key={id} className="border-b border-slate-100 text-slate-800">
                      <td className="px-3 py-3 font-semibold text-slate-900">{row.name || "Empresa sin nombre"}</td>
                      <td className="px-3 py-3"><Badge label={status} /></td>
                      <td className="px-3 py-3">{membersByCompany.get(id) || 0}</td>
                      <td className="px-3 py-3">{requestsByCompany.get(id) || 0}</td>
                      <td className="px-3 py-3">{pendingByCompany.get(id) || 0}</td>
                      <td className="px-3 py-3">{completion}% completado</td>
                      <td className="px-3 py-3">{lastActivityByCompany.get(id) ? new Date(lastActivityByCompany.get(id)!).toLocaleDateString("es-ES") : "Sin actividad"}</td>
                      <td className="px-3 py-3">{row.created_at ? new Date(row.created_at).toLocaleDateString("es-ES") : "—"}</td>
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
