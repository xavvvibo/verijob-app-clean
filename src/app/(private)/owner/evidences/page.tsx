import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

function evidenceLabel(type: unknown) {
  const t = String(type || "").toLowerCase();
  if (!t) return "Sin tipo";
  if (t.includes("contr")) return "Contrato";
  if (t.includes("nomina")) return "Nómina";
  if (t.includes("vida")) return "Vida laboral";
  return String(type);
}

export default async function OwnerEvidencesPage() {
  const supabase = await createClient();

  const { data: evidences } = await supabase
    .from("evidences")
    .select("id,uploaded_by,evidence_type,verification_request_id,storage_path,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = Array.isArray(evidences) ? evidences : [];
  const userIds = Array.from(new Set(rows.map((r: any) => r.uploaded_by).filter(Boolean)));

  const [profilesRes, requestsRes] = await Promise.all([
    userIds.length ? supabase.from("profiles").select("id,full_name,email").in("id", userIds) : Promise.resolve({ data: [] } as any),
    rows.length ? supabase.from("verification_requests").select("id,status").in("id", rows.map((r: any) => r.verification_request_id).filter(Boolean)) : Promise.resolve({ data: [] } as any),
  ]);

  const profiles = new Map((Array.isArray(profilesRes.data) ? profilesRes.data : []).map((p: any) => [String(p.id), p]));
  const requests = new Map((Array.isArray(requestsRes.data) ? requestsRes.data : []).map((r: any) => [String(r.id), r]));

  const byType = rows.reduce<Record<string, number>>((acc, row: any) => {
    const key = evidenceLabel(row.evidence_type);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Evidencias</h1>
        <p className="mt-2 text-sm text-slate-600">
          Volumen y calidad operativa de evidencias subidas por candidatos y su vinculación a verificaciones.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {Object.keys(byType).length === 0 ? <span className="text-slate-500">Sin evidencias registradas.</span> : null}
          {Object.entries(byType).map(([type, count]) => (
            <span key={type} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700">
              {type}: {count}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-600">
            Todavía no hay evidencias disponibles.
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-[1050px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">Candidato</th>
                  <th className="px-3 py-3">Tipo</th>
                  <th className="px-3 py-3">Estado verificación</th>
                  <th className="px-3 py-3">Solicitud</th>
                  <th className="px-3 py-3">Documento</th>
                  <th className="px-3 py-3">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any) => {
                  const profile = profiles.get(String(row.uploaded_by || "")) as any;
                  const request = requests.get(String(row.verification_request_id || "")) as any;
                  const doc = String(row.storage_path || "").split("/").pop() || "documento";
                  return (
                    <tr key={row.id} className="border-b border-slate-100 text-slate-800">
                      <td className="px-3 py-3">
                        <div className="font-semibold text-slate-900">{profile?.full_name || profile?.email || "Usuario"}</div>
                        <div className="text-xs text-slate-500">{profile?.email || "—"}</div>
                      </td>
                      <td className="px-3 py-3">{evidenceLabel(row.evidence_type)}</td>
                      <td className="px-3 py-3">{request?.status || "Sin estado"}</td>
                      <td className="px-3 py-3">{row.verification_request_id || "—"}</td>
                      <td className="px-3 py-3">{doc}</td>
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
