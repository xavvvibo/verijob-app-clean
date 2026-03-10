import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

function evidenceLabel(type: unknown) {
  const t = String(type || "").toLowerCase();
  if (!t) return "Sin tipo";
  if (t.includes("contr")) return "Contrato";
  if (t.includes("nomina")) return "Nómina";
  if (t.includes("vida")) return "Vida laboral";
  if (t.includes("cert")) return "Certificado";
  return String(type);
}

function verificationState(status: unknown) {
  const s = String(status || "").toLowerCase();
  if (!s) return "sin_estado";
  if (s === "approved" || s === "verified") return "verificada";
  if (s === "rejected") return "rechazada";
  if (s.includes("pending") || s.includes("request")) return "pendiente";
  return s;
}

export default async function OwnerEvidencesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const typeFilter = String(sp.type || "all").toLowerCase();
  const stateFilter = String(sp.state || "all").toLowerCase();
  const linkedFilter = String(sp.linked || "all").toLowerCase();

  const supabase = await createClient();

  const { data: evidences } = await supabase
    .from("evidences")
    .select("id,uploaded_by,evidence_type,verification_request_id,storage_path,created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  const rows = Array.isArray(evidences) ? evidences : [];
  const userIds = Array.from(new Set(rows.map((r: any) => r.uploaded_by).filter(Boolean)));

  const [profilesRes, requestsRes] = await Promise.all([
    userIds.length
      ? supabase.from("profiles").select("id,full_name,email").in("id", userIds)
      : Promise.resolve({ data: [] } as any),
    rows.length
      ? supabase
          .from("verification_requests")
          .select("id,status")
          .in("id", rows.map((r: any) => r.verification_request_id).filter(Boolean))
      : Promise.resolve({ data: [] } as any),
  ]);

  const profiles = new Map((Array.isArray(profilesRes.data) ? profilesRes.data : []).map((p: any) => [String(p.id), p]));
  const requests = new Map((Array.isArray(requestsRes.data) ? requestsRes.data : []).map((r: any) => [String(r.id), r]));

  const normalized = rows.map((row: any) => {
    const type = evidenceLabel(row.evidence_type);
    const req = requests.get(String(row.verification_request_id || "")) as any;
    const state = verificationState(req?.status);
    const linked = Boolean(row.verification_request_id);
    return { row, type, state, linked };
  });

  const filtered = normalized.filter((entry) => {
    if (typeFilter !== "all" && entry.type.toLowerCase() !== typeFilter) return false;
    if (stateFilter !== "all" && entry.state !== stateFilter) return false;
    if (linkedFilter !== "all") {
      if (linkedFilter === "linked" && !entry.linked) return false;
      if (linkedFilter === "unlinked" && entry.linked) return false;
    }
    return true;
  });

  const byType = normalized.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.type] = (acc[entry.type] || 0) + 1;
    return acc;
  }, {});
  const noState = normalized.filter((x) => x.state === "sin_estado").length;
  const unlinked = normalized.filter((x) => !x.linked).length;

  const types = Array.from(new Set(normalized.map((x) => x.type.toLowerCase()))).filter(Boolean);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Evidencias</h1>
        <p className="mt-1 text-sm text-slate-600">
          Control de volumen, estado operativo y vinculación de evidencias con procesos de verificación.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Sin estado</div>
            <div className="text-xl font-semibold text-slate-900">{noState}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Sin vinculación</div>
            <div className="text-xl font-semibold text-slate-900">{unlinked}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Total evidencias</div>
            <div className="text-xl font-semibold text-slate-900">{normalized.length}</div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {Object.keys(byType).length === 0 ? <span className="text-slate-500">Sin evidencias registradas.</span> : null}
          {Object.entries(byType).map(([type, count]) => (
            <span key={type} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700">
              {type}: {count}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <form className="grid gap-3 md:grid-cols-4">
          <select name="type" defaultValue={typeFilter} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">Tipo: todos</option>
            {types.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <select name="state" defaultValue={stateFilter} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">Estado: todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="verificada">Verificada</option>
            <option value="rechazada">Rechazada</option>
            <option value="sin_estado">Sin estado</option>
          </select>
          <select name="linked" defaultValue={linkedFilter} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">Vinculación: todas</option>
            <option value="linked">Con verificación</option>
            <option value="unlinked">Sin verificación</option>
          </select>
          <div className="flex gap-2">
            <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Aplicar</button>
            <Link href="/owner/evidences" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
              Limpiar
            </Link>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-600">
            No hay evidencias para los filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-[1080px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">Candidato</th>
                  <th className="px-3 py-3">Tipo</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Vinculación</th>
                  <th className="px-3 py-3">Documento</th>
                  <th className="px-3 py-3">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => {
                  const row: any = entry.row;
                  const profile = profiles.get(String(row.uploaded_by || "")) as any;
                  const doc = String(row.storage_path || "").split("/").pop() || "documento";
                  return (
                    <tr key={row.id} className="border-b border-slate-100 text-slate-800">
                      <td className="px-3 py-3">
                        <div className="font-semibold text-slate-900">{profile?.full_name || profile?.email || "Usuario"}</div>
                        <div className="text-xs text-slate-500">{profile?.email || "—"}</div>
                      </td>
                      <td className="px-3 py-3">{entry.type}</td>
                      <td className="px-3 py-3">
                        <span className={entry.state === "sin_estado" ? "font-semibold text-amber-700" : "text-slate-800"}>
                          {entry.state.replaceAll("_", " ")}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {entry.linked ? (
                          <span className="text-emerald-700">Ligada a verificación</span>
                        ) : (
                          <span className="font-semibold text-amber-700">Sin vinculación</span>
                        )}
                      </td>
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
