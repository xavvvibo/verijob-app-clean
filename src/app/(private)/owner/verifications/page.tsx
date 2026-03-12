import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";

export const dynamic = "force-dynamic";

function canonicalStatus(raw: unknown, revokedAt: unknown) {
  if (revokedAt) return "revoked";
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return "draft";
  if (s === "approved") return "verified";
  if (
    s === "draft" ||
    s === "pending_company" ||
    s === "reviewing" ||
    s === "verified" ||
    s === "rejected" ||
    s === "revoked"
  ) {
    return s;
  }
  return "draft";
}

function statusLabel(raw: string) {
  const v = String(raw || "").toLowerCase();
  if (v === "draft") return "Draft";
  if (v === "pending_company") return "Pendiente empresa";
  if (v === "reviewing") return "En revisión";
  if (v === "verified") return "Verificada";
  if (v === "rejected") return "Rechazada";
  if (v === "revoked") return "Revocada";
  return v || "Sin estado";
}

function statusClass(raw: string) {
  const v = String(raw || "").toLowerCase();
  if (v === "verified") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (v === "rejected") return "border-rose-200 bg-rose-50 text-rose-800";
  if (v === "revoked") return "border-slate-300 bg-slate-100 text-slate-700";
  if (v === "reviewing") return "border-amber-200 bg-amber-50 text-amber-800";
  if (v === "pending_company") return "border-indigo-200 bg-indigo-50 text-indigo-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function methodLabel(raw: unknown) {
  const v = String(raw || "email").toLowerCase();
  if (v === "email") return "Email";
  if (v === "documentary") return "Documental";
  return v || "email";
}

function safeDate(v: unknown) {
  if (!v) return "—";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-ES");
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
  const companyFilter = String(sp.company || "").trim().toLowerCase();
  const q = String(sp.q || "").trim().toLowerCase();
  const focus = String(sp.focus || "").trim();

  const now = Date.now();
  const fromMs =
    rangeFilter === "7d"
      ? now - 7 * 24 * 60 * 60 * 1000
      : rangeFilter === "30d"
        ? now - 30 * 24 * 60 * 60 * 1000
        : rangeFilter === "90d"
          ? now - 90 * 24 * 60 * 60 * 1000
        : null;

  const sessionClient = await createServerSupabaseClient();
  const { data: auth } = await sessionClient.auth.getUser();
  if (!auth?.user) redirect("/login?next=/owner/verifications");
  const { data: ownerProfile } = await sessionClient.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  const ownerRole = String(ownerProfile?.role || "").toLowerCase();
  if (ownerRole !== "owner" && ownerRole !== "admin") {
    redirect("/dashboard?forbidden=1&from=owner");
  }

  const supabase = createServiceRoleClient();

  const { data: requests, error: requestsError } = await supabase
    .from("verification_requests")
    .select(
      "id,requested_by,company_id,employment_record_id,status,verification_channel,requested_at,resolved_at,created_at,updated_at,revoked_at,company_name_target,request_context",
    )
    .order("requested_at", { ascending: false })
    .limit(500);

  const rows = Array.isArray(requests) ? requests : [];

  const userIds = Array.from(new Set(rows.map((r: any) => r.requested_by).filter(Boolean))).filter(Boolean);
  const companyIds = Array.from(new Set(rows.map((r: any) => r.company_id).filter(Boolean)));
  const employmentIds = Array.from(new Set(rows.map((r: any) => r.employment_record_id).filter(Boolean)));
  const verificationIds = rows.map((r: any) => r.id).filter(Boolean);

  const [profilesRes, companiesRes, employmentRes, evidencesRes] = await Promise.all([
    userIds.length
      ? supabase.from("profiles").select("id,full_name,email").in("id", userIds)
      : Promise.resolve({ data: [] } as any),
    companyIds.length
      ? supabase.from("companies").select("id,name").in("id", companyIds)
      : Promise.resolve({ data: [] } as any),
    employmentIds.length
      ? supabase.from("employment_records").select("id,position,company_name_freeform,start_date,end_date").in("id", employmentIds)
      : Promise.resolve({ data: [] } as any),
    verificationIds.length
      ? supabase.from("evidences").select("id,verification_request_id").in("verification_request_id", verificationIds)
      : Promise.resolve({ data: [] } as any),
  ]);

  const profiles = new Map((Array.isArray(profilesRes.data) ? profilesRes.data : []).map((p: any) => [String(p.id), p]));
  const companies = new Map((Array.isArray(companiesRes.data) ? companiesRes.data : []).map((c: any) => [String(c.id), c]));
  const employmentById = new Map((Array.isArray(employmentRes.data) ? employmentRes.data : []).map((e: any) => [String(e.id), e]));
  const evidencesByVerification = new Map<string, number>();
  for (const evidence of Array.isArray(evidencesRes.data) ? evidencesRes.data : []) {
    const key = String((evidence as any).verification_request_id || "");
    if (!key) continue;
    evidencesByVerification.set(key, (evidencesByVerification.get(key) || 0) + 1);
  }

  const normalized = rows.map((row: any) => {
    const status = canonicalStatus(row.status, row.revoked_at);
    const method = String(row.verification_channel || "email").toLowerCase();
    const requestedAt = row.requested_at ? new Date(row.requested_at).getTime() : null;
    const profile = profiles.get(String(row.requested_by || "")) as any;
    const company = companies.get(String(row.company_id || "")) as any;
    const employment = employmentById.get(String(row.employment_record_id || "")) as any;
    const requestContext = row?.request_context && typeof row.request_context === "object" ? row.request_context : {};
    const roleTitle = String((requestContext as any)?.role_title || "").trim();
    const companyNameFromContext = String((requestContext as any)?.company_name || "").trim();
    const candidateName = String(profile?.full_name || profile?.email || "").trim();
    const companyName = String(company?.name || row.company_name_target || companyNameFromContext || employment?.company_name_freeform || "").trim();
    const experienceLabel = String(employment?.position || roleTitle || "Experiencia no indicada").trim();
    return {
      row,
      status,
      method,
      requestedAt,
      candidateName,
      companyName,
      experienceLabel,
      evidenceCount: evidencesByVerification.get(String(row.id)) || 0,
    };
  });

  const filtered = normalized.filter((entry) => {
    if (statusFilter !== "all" && entry.status !== statusFilter) return false;
    if (methodFilter !== "all" && entry.method !== methodFilter) return false;
    if (fromMs && (!entry.requestedAt || entry.requestedAt < fromMs)) return false;
    if (companyFilter && !entry.companyName.toLowerCase().includes(companyFilter)) return false;
    if (q) {
      const haystack = [
        entry.row?.id,
        entry.candidateName,
        entry.companyName,
        entry.experienceLabel,
        entry.row?.verification_channel,
      ]
        .map((v) => String(v || "").toLowerCase())
        .join(" ");
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const summary = {
    total: normalized.length,
    draft: normalized.filter((x) => x.status === "draft").length,
    pending_company: normalized.filter((x) => x.status === "pending_company").length,
    reviewing: normalized.filter((x) => x.status === "reviewing").length,
    verified: normalized.filter((x) => x.status === "verified").length,
    rejected: normalized.filter((x) => x.status === "rejected").length,
    revoked: normalized.filter((x) => x.status === "revoked").length,
  };

  const methods = Array.from(new Set(normalized.map((x) => x.method))).filter(Boolean);
  const focusEntry = focus ? filtered.find((entry) => String(entry.row?.id || "") === focus) || null : null;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Cola de verificaciones</h1>
        <p className="mt-1 text-sm text-slate-600">
          Cola operativa de revisión owner con estado real, método, trazabilidad temporal y acceso rápido a candidato, empresa y evidencias.
        </p>
        {requestsError ? <p className="mt-2 text-xs font-medium text-rose-700">No se pudo cargar la cola: {requestsError.message}</p> : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Total</div>
            <div className="text-xl font-semibold text-slate-900">{summary.total}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Draft</div>
            <div className="text-xl font-semibold text-slate-900">{summary.draft}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Pending company</div>
            <div className="text-xl font-semibold text-slate-900">{summary.pending_company}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Reviewing</div>
            <div className="text-xl font-semibold text-slate-900">{summary.reviewing}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Verified</div>
            <div className="text-xl font-semibold text-slate-900">{summary.verified}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Rejected</div>
            <div className="text-xl font-semibold text-slate-900">{summary.rejected}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Revoked</div>
            <div className="text-xl font-semibold text-slate-900">{summary.revoked}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Resultado filtros</div>
            <div className="text-xl font-semibold text-slate-900">{filtered.length}</div>
          </div>
        </div>
      </section>

      {focusEntry ? (
        <section className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Detalle rápido · {focusEntry.row.id}</h2>
          <div className="mt-2 grid gap-3 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Candidato</div>
              <div className="font-medium text-slate-900">{focusEntry.candidateName || "Sin dato"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Empresa</div>
              <div className="font-medium text-slate-900">{focusEntry.companyName || "Empresa externa"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Experiencia</div>
              <div className="font-medium text-slate-900">{focusEntry.experienceLabel}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Evidencias</div>
              <div className="font-medium text-slate-900">{focusEntry.evidenceCount}</div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <form className="grid gap-3 md:grid-cols-6">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por id, candidato, empresa o experiencia"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          />
          <input
            name="company"
            defaultValue={companyFilter}
            placeholder="Empresa"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select name="status" defaultValue={statusFilter} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">Estado: todos</option>
            <option value="draft">Draft</option>
            <option value="pending_company">Pending company</option>
            <option value="reviewing">Reviewing</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
            <option value="revoked">Revoked</option>
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
            <option value="90d">Últimos 90 días</option>
          </select>
          <div className="flex gap-2 md:col-span-6">
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
            <table className="min-w-[1520px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">ID</th>
                  <th className="px-3 py-3">Candidato</th>
                  <th className="px-3 py-3">Empresa</th>
                  <th className="px-3 py-3">Experiencia</th>
                  <th className="px-3 py-3">Método</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Evidencias</th>
                  <th className="px-3 py-3">Creada</th>
                  <th className="px-3 py-3">Actualizada</th>
                  <th className="px-3 py-3">Resuelta</th>
                  <th className="px-3 py-3">Revocada</th>
                  <th className="px-3 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => {
                  const row: any = entry.row;
                  return (
                    <tr key={row.id} className="border-b border-slate-100 text-slate-800">
                      <td className="px-3 py-3">
                        <div className="font-mono text-xs text-slate-700">{row.id}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-slate-900">{entry.candidateName || "Candidato sin perfil"}</div>
                        <div className="text-xs text-slate-500">{row.requested_by || "—"}</div>
                      </td>
                      <td className="px-3 py-3">{entry.companyName || "Empresa externa"}</td>
                      <td className="px-3 py-3">{entry.experienceLabel}</td>
                      <td className="px-3 py-3">{methodLabel(entry.method)}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(entry.status)}`}>
                          {statusLabel(entry.status)}
                        </span>
                      </td>
                      <td className="px-3 py-3">{entry.evidenceCount}</td>
                      <td className="px-3 py-3">{safeDate(row.created_at || row.requested_at)}</td>
                      <td className="px-3 py-3">{safeDate(row.updated_at)}</td>
                      <td className="px-3 py-3">{safeDate(row.resolved_at)}</td>
                      <td className="px-3 py-3">{row.revoked_at ? safeDate(row.revoked_at) : "—"}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <Link
                            href={`/owner/verifications?focus=${row.id}${statusFilter !== "all" ? `&status=${encodeURIComponent(statusFilter)}` : ""}${methodFilter !== "all" ? `&method=${encodeURIComponent(methodFilter)}` : ""}${rangeFilter !== "all" ? `&range=${encodeURIComponent(rangeFilter)}` : ""}${companyFilter ? `&company=${encodeURIComponent(companyFilter)}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Ver detalle
                          </Link>
                          {row.requested_by ? (
                            <Link href={`/owner/users/${row.requested_by}`} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                              Abrir candidato
                            </Link>
                          ) : null}
                          {entry.companyName ? (
                            <Link href={`/owner/companies?q=${encodeURIComponent(entry.companyName)}`} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                              Abrir empresa
                            </Link>
                          ) : null}
                          <Link href={`/owner/evidences?linked=linked`} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                            Ver evidencias
                          </Link>
                        </div>
                      </td>
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
