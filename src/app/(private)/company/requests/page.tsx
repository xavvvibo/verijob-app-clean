import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { readEffectiveCompanySubscriptionState } from "@/lib/billing/effectiveSubscription";
import { normalizeEmailDomain, normalizeHost } from "@/lib/verification/verifier-email-signal";

type VerificationRequestRow = {
  id: string;
  requested_by: string | null;
  status: string | null;
  requested_at: string | null;
  created_at?: string | null;
  resolved_at: string | null;
  company_name_target: string | null;
  external_email_target?: string | null;
  request_context?: Record<string, any> | null;
  company_id?: string | null;
  employment_record_id?: string | null;
  employment_records:
    | {
        position: string | null;
        company_name_freeform: string | null;
        start_date: string | null;
        end_date: string | null;
      }
    | {
        position: string | null;
        company_name_freeform: string | null;
        start_date: string | null;
        end_date: string | null;
      }[]
    | null;
};

type ReqRow = {
  verification_id: string;
  candidate_id: string | null;
  candidate_name: string | null;
  position: string | null;
  status_effective: string | null;
  start_date: string | null;
  end_date: string | null;
  company_name_freeform: string | null;
  requested_at: string | null;
  resolved_at: string | null;
  evidence_count: number;
  actions_count: number;
  reuse_events: number;
};

const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const RECENT_THRESHOLD_TS = Date.now() - RECENT_WINDOW_MS;

function statusLabel(v: string | null) {
  if (v === "verified") return "Verificado";
  if (v === "pending_acceptance") return "Pendiente de respuesta";
  if (v === "requested" || v === "pending_company") return "Pendiente empresa";
  if (v === "reviewing") return "En revisión";
  if (v === "rejected") return "Rechazado";
  if (v === "revoked") return "Revocada";
  return "Sin estado";
}

function statusClass(v: string | null) {
  if (v === "verified") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (v === "pending_company" || v === "reviewing") return "bg-amber-50 text-amber-800 border-amber-200";
  if (v === "rejected" || v === "revoked") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function formatDate(value: string | null) {
  if (!value) return "Pendiente";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Pendiente";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function isPendingStatus(value: string | null) {
  const status = String(value || "").toLowerCase();
  return status === "pending_company" || status === "reviewing";
}

function isResolvedStatus(value: string | null) {
  const status = String(value || "").toLowerCase();
  return status === "verified" || status === "rejected" || status === "revoked";
}

export default async function CompanyRequestsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const filter = typeof params?.filter === "string" ? params.filter : "pending";
  const sort = typeof params?.sort === "string" ? params.sort : "priority";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_company_id, onboarding_completed")
    .eq("id", user.id)
    .single();

  if (!profile?.onboarding_completed) redirect("/onboarding/company?blocked=1&source=company");
  if (!profile?.active_company_id) redirect("/company");

  const [{ data: allData }, { data: companyProfile }, { data: companyMembers }] = await Promise.all([
    supabase
      .from("verification_requests")
      .select("id,requested_by,status,requested_at,created_at,resolved_at,company_name_target,external_email_target,request_context,employment_record_id,company_id,employment_records(position,company_name_freeform,start_date,end_date)")
      .or(`company_id.eq.${profile.active_company_id},company_id.is.null`),
    supabase
      .from("company_profiles")
      .select("contact_email,website_url,trade_name,legal_name")
      .eq("company_id", profile.active_company_id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("email")
      .eq("role", "company")
      .eq("active_company_id", profile.active_company_id),
  ]);

  const companyEmailDomain = normalizeEmailDomain((companyProfile as any)?.contact_email || null);
  const companyWebsiteDomain = normalizeHost((companyProfile as any)?.website_url || null);
  const companyMemberDomains = new Set(
    (Array.isArray(companyMembers) ? companyMembers : [])
      .map((row: any) => normalizeEmailDomain((row as any)?.email || null))
      .filter(Boolean) as string[],
  );

  const effectiveSubscription = await readEffectiveCompanySubscriptionState(supabase, {
    userId: user.id,
    companyId: String(profile.active_company_id),
  });
  const planActive = ["active", "trialing"].includes(String(effectiveSubscription.status || "").toLowerCase());

  const baseRows = ((allData || []) as VerificationRequestRow[]).filter((row: any) => {
    if (String((row as any)?.company_id || "") === String(profile.active_company_id)) return true;
    const targetDomain = normalizeEmailDomain((row as any)?.external_email_target || null);
    const requestContext = row?.request_context && typeof row.request_context === "object" ? row.request_context : {};
    const resolution = String((requestContext as any)?.company_association_resolution || "").trim().toLowerCase();
    return Boolean(
      targetDomain &&
        (
          (companyEmailDomain && targetDomain === companyEmailDomain) ||
          (companyWebsiteDomain && targetDomain === companyWebsiteDomain) ||
          companyMemberDomains.has(targetDomain)
        ),
    ) || Boolean(
      !String((row as any)?.company_id || "").trim() &&
      resolution &&
      resolution !== "unresolved" &&
      resolution !== "ambiguous_exact_match" &&
      resolution !== "ambiguous_domain_match" &&
      targetDomain &&
      (
        (companyEmailDomain && targetDomain === companyEmailDomain) ||
        (companyWebsiteDomain && targetDomain === companyWebsiteDomain) ||
        companyMemberDomains.has(targetDomain)
      ),
    );
  });

  const verificationIds = baseRows.map((row) => row.id);
  const candidateIds = Array.from(new Set(baseRows.map((row) => row.requested_by).filter(Boolean))) as string[];

  const [candidateRowsRes, summaryRowsRes, reuseRowsRes] = await Promise.all([
    candidateIds.length
      ? supabase.from("profiles").select("id,full_name").in("id", candidateIds)
      : Promise.resolve({ data: [] } as any),
    verificationIds.length
      ? supabase
          .from("verification_summary")
          .select("verification_id,status_effective,is_revoked,evidence_count,actions_count")
          .in("verification_id", verificationIds)
      : Promise.resolve({ data: [] } as any),
    verificationIds.length
      ? supabase
          .from("verification_reuse_events")
          .select("verification_id,id")
          .eq("company_id", profile.active_company_id)
          .in("verification_id", verificationIds)
      : Promise.resolve({ data: [] } as any),
  ]);

  const candidateNameMap = new Map<string, string>();
  for (const row of candidateRowsRes.data || []) {
    candidateNameMap.set(String((row as any).id), String((row as any).full_name || ""));
  }

  const summaryMap = new Map<string, any>();
  for (const row of summaryRowsRes.data || []) {
    summaryMap.set(String((row as any).verification_id), row);
  }

  const reuseCountMap = new Map<string, number>();
  for (const row of reuseRowsRes.data || []) {
    const key = String((row as any).verification_id || "");
    if (!key) continue;
    reuseCountMap.set(key, Number(reuseCountMap.get(key) || 0) + 1);
  }

  const rows: ReqRow[] = baseRows.map((row) => {
    const employment = Array.isArray(row.employment_records) ? row.employment_records[0] : row.employment_records;
    const summary = summaryMap.get(row.id) as any;
    const statusEffective = summary?.is_revoked ? "revoked" : summary?.status_effective || row.status || null;
    return {
      verification_id: row.id,
      candidate_id: row.requested_by,
      candidate_name: row.requested_by ? candidateNameMap.get(row.requested_by) || row.requested_by : null,
      position: employment?.position || null,
      status_effective: statusEffective,
      start_date: employment?.start_date || null,
      end_date: employment?.end_date || null,
      company_name_freeform: employment?.company_name_freeform || row.company_name_target || null,
      requested_at: row.requested_at || row.created_at || null,
      resolved_at: row.resolved_at || null,
      evidence_count: Number(summary?.evidence_count || 0),
      actions_count: Number(summary?.actions_count || 0),
      reuse_events: Number(reuseCountMap.get(row.id) || 0),
    };
  });

  const counts = {
    pending: rows.filter((r) => isPendingStatus(r.status_effective)).length,
    resolved: rows.filter((r) => isResolvedStatus(r.status_effective)).length,
    recent: rows.filter((r) => {
      const ts = Date.parse(String(r.requested_at || ""));
      return Number.isFinite(ts) && ts >= RECENT_THRESHOLD_TS;
    }).length,
    withEvidence: rows.filter((r) => r.evidence_count > 0).length,
    withReuse: rows.filter((r) => r.reuse_events > 0).length,
  };

  let filtered = rows;
  if (filter === "pending") filtered = rows.filter((r) => isPendingStatus(r.status_effective));
  if (filter === "resolved") filtered = rows.filter((r) => isResolvedStatus(r.status_effective));
  if (filter === "recent") {
    filtered = rows.filter((r) => {
      const ts = Date.parse(String(r.requested_at || ""));
      return Number.isFinite(ts) && ts >= RECENT_THRESHOLD_TS;
    });
  }
  if (filter === "with_evidence") filtered = rows.filter((r) => r.evidence_count > 0);
  if (filter === "with_reuse") filtered = rows.filter((r) => r.reuse_events > 0);

  filtered = filtered.sort((a, b) => {
    const priority = (row: ReqRow) => {
      if (isPendingStatus(row.status_effective) && row.evidence_count > 0) return 5;
      if (isPendingStatus(row.status_effective)) return 4;
      if (row.reuse_events > 0) return 3;
      if (row.evidence_count > 0) return 2;
      return 1;
    };

    if (sort === "priority") {
      return priority(b) - priority(a) || Date.parse(String(b.requested_at || 0)) - Date.parse(String(a.requested_at || 0));
    }
    if (sort === "recent") {
      return Date.parse(String(b.requested_at || 0)) - Date.parse(String(a.requested_at || 0));
    }
    return Date.parse(String(a.requested_at || 0)) - Date.parse(String(b.requested_at || 0));
  });

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Solicitudes de validación</h1>
            <p className="mt-2 text-sm text-slate-600">Resuelve primero lo pendiente con evidencias para decidir más rápido y con menos fricción.</p>
          </div>
          <Link href="?filter=pending&sort=priority" className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black">
            Resolver pendientes
          </Link>
        </div>
        {!planActive ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Puedes revisar y resolver solicitudes aunque tu empresa esté en plan Free.
            <Link href="/company/upgrade" className="ml-2 font-semibold underline underline-offset-2">
              Ver opciones
            </Link>
          </div>
        ) : null}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Prioriza así</p>
          <p className="mt-2 text-sm text-slate-600">Primero pendientes con evidencias, después recientes sin resolver. Las resueltas se quedan solo como histórico operativo.</p>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-5">
        <Link href="?filter=pending&sort=priority" className={`rounded-2xl border p-4 ${filter === "pending" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"}`}>
          <div className="text-xs uppercase tracking-wide">Pendientes</div>
          <div className="mt-2 text-2xl font-semibold">{counts.pending}</div>
        </Link>
        <Link href="?filter=resolved&sort=recent" className={`rounded-2xl border p-4 ${filter === "resolved" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"}`}>
          <div className="text-xs uppercase tracking-wide">Resueltas</div>
          <div className="mt-2 text-2xl font-semibold">{counts.resolved}</div>
        </Link>
        <Link href="?filter=recent&sort=recent" className={`rounded-2xl border p-4 ${filter === "recent" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"}`}>
          <div className="text-xs uppercase tracking-wide">Recientes</div>
          <div className="mt-2 text-2xl font-semibold">{counts.recent}</div>
        </Link>
        <Link href="?filter=with_evidence&sort=priority" className={`rounded-2xl border p-4 ${filter === "with_evidence" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"}`}>
          <div className="text-xs uppercase tracking-wide">Con evidencias</div>
          <div className="mt-2 text-2xl font-semibold">{counts.withEvidence}</div>
        </Link>
        <Link href="?filter=with_reuse&sort=priority" className={`rounded-2xl border p-4 ${filter === "with_reuse" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"}`}>
          <div className="text-xs uppercase tracking-wide">Con uso histórico</div>
          <div className="mt-2 text-2xl font-semibold">{counts.withReuse}</div>
        </Link>
      </section>

      <section className="flex flex-wrap gap-2">
        <Link href={`?filter=${filter}&sort=priority`} className={`rounded-full border px-3 py-1.5 text-sm ${sort === "priority" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200"}`}>
          Ordenar por prioridad
        </Link>
        <Link href={`?filter=${filter}&sort=recent`} className={`rounded-full border px-3 py-1.5 text-sm ${sort === "recent" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200"}`}>
          Más recientes
        </Link>
        <Link href={`?filter=${filter}&sort=oldest`} className={`rounded-full border px-3 py-1.5 text-sm ${sort === "oldest" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200"}`}>
          Más antiguas
        </Link>
      </section>

      <section className="space-y-4">
        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500 shadow-sm">
            {filter === "pending" ? (
              <div>
                <p className="font-semibold text-slate-900">No hay solicitudes pendientes ahora mismo.</p>
                <p className="mt-2">La cola está limpia. Puedes dedicar este tiempo a revisar candidatos con más señal y decidir mejor dónde abrir contexto.</p>
                <Link href="/company/candidates" className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black">
                  Ir a candidatos con señal
                </Link>
              </div>
            ) : (
              <div>
                <p className="font-semibold text-slate-900">No hay solicitudes para este filtro.</p>
                <p className="mt-2">Vuelve a pendientes para priorizar decisiones con impacto real en validación.</p>
                <Link href="?filter=pending&sort=priority" className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black">
                  Ver pendientes
                </Link>
              </div>
            )}
          </div>
        ) : null}

        {filtered.map((row) => (
          <article key={row.verification_id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="truncate text-lg font-semibold text-slate-900">
                    {row.candidate_name || "Candidato"}
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(row.status_effective)}`}>
                    {statusLabel(row.status_effective)}
                  </span>
                </div>

                <div className="mt-2 text-sm text-slate-700">
                  {row.position || "Puesto pendiente de completar"} · {row.company_name_freeform || "Empresa"}
                </div>

                <div className="mt-1 text-sm text-slate-500">
                  {row.start_date ? formatDate(row.start_date) : "Pendiente"} — {row.end_date ? formatDate(row.end_date) : "Actualidad"}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700">
                    {row.evidence_count} {row.evidence_count === 1 ? "evidencia" : "evidencias"}
                  </span>
                  {row.reuse_events > 0 ? (
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 font-semibold text-blue-800">
                      {row.reuse_events} reutilización{row.reuse_events === 1 ? "" : "es"}
                    </span>
                  ) : null}
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700">
                    {isPendingStatus(row.status_effective) ? "Pendiente de decisión" : "Trazabilidad"}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/company/verification/${row.verification_id}`}
                  className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  {isPendingStatus(row.status_effective) ? "Abrir y resolver" : "Ver detalle"}
                </Link>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Recibida</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{formatDate(row.requested_at)}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Resuelta</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{formatDate(row.resolved_at)}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Evidencias</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{row.evidence_count}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Actividad</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{row.actions_count}</div>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              {isPendingStatus(row.status_effective)
                ? "Pendiente de decisión. Resolverla ahora acelera confianza y evita que la señal se quede bloqueada."
                : "Solicitud ya resuelta. El detalle mantiene la trazabilidad completa de la decisión."}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
