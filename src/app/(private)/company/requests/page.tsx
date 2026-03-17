import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { readEffectiveCompanySubscriptionState } from "@/lib/billing/effectiveSubscription";

type VerificationRequestRow = {
  id: string;
  requested_by: string | null;
  status: string | null;
  requested_at: string | null;
  created_at?: string | null;
  resolved_at: string | null;
  company_name_target: string | null;
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
  if (v === "verified") return "Confirmada";
  if (v === "pending_company" || v === "reviewing") return "Pendiente";
  if (v === "rejected") return "Rechazada";
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
  if (!value) return "No disponible";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "No disponible";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function periodLabel(startDate: string | null, endDate: string | null) {
  return `${formatDate(startDate)} — ${endDate ? formatDate(endDate) : "Actualidad"}`;
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

  const { data: allData } = await supabase
    .from("verification_requests")
    .select("id,requested_by,status,requested_at,created_at,resolved_at,company_name_target,employment_record_id,employment_records(position,company_name_freeform,start_date,end_date)")
    .eq("company_id", profile.active_company_id);

  const effectiveSubscription = await readEffectiveCompanySubscriptionState(supabase, {
    userId: user.id,
    companyId: String(profile.active_company_id),
  });
  const planActive = ["active", "trialing"].includes(String(effectiveSubscription.status || "").toLowerCase());
  const baseRows = (allData || []) as VerificationRequestRow[];
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
      candidate_name: row.requested_by ? candidateNameMap.get(row.requested_by) || null : null,
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
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Solicitudes</h1>
        <p className="mt-2 text-sm text-slate-600">
          Inbox operativa para revisar solicitudes que llegan cuando un candidato pide validar una experiencia frente a tu empresa.
        </p>
        {!planActive ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Puedes revisar y resolver las solicitudes recibidas aunque tu empresa esté en plan Free. El plan afecta a accesos a perfiles, colaboración y capacidad operativa adicional, no a responder validaciones ya recibidas.
            <Link href="/company/upgrade" className="ml-2 font-semibold underline underline-offset-2">
              Ver opciones
            </Link>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-5">
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
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600 shadow-sm">
            <p>No hay solicitudes en esta vista ahora mismo.</p>
            <p className="mt-2">Cuando lleguen nuevas verificaciones o evidencias útiles, aparecerán aquí con prioridad operativa.</p>
          </div>
        ) : (
          filtered.map((row) => (
            <article key={row.verification_id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-900">{row.candidate_name || row.candidate_id || "Candidato"}</h2>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(row.status_effective)}`}>
                      {statusLabel(row.status_effective)}
                    </span>
                    {row.evidence_count > 0 ? (
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
                        {row.evidence_count} evidencias
                      </span>
                    ) : null}
                    {row.reuse_events > 0 ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        {row.reuse_events} usos históricos
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{row.position || "Puesto no especificado"} · {row.company_name_freeform || "Empresa no especificada"}</p>
                  <p className="mt-1 text-sm text-slate-500">{periodLabel(row.start_date, row.end_date)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href={`/company/verification/${row.verification_id}`} className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black">
                    Revisar y resolver
                  </a>
                  <a href={`/api/verification/${row.verification_id}/summary`} target="_blank" rel="noreferrer" className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                    Ver resumen JSON
                  </a>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4 text-sm">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-slate-500">Recibida</div>
                  <div className="mt-1 font-semibold text-slate-900">{formatDate(row.requested_at)}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-slate-500">Resuelta</div>
                  <div className="mt-1 font-semibold text-slate-900">{formatDate(row.resolved_at)}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-slate-500">Evidencias</div>
                  <div className="mt-1 font-semibold text-slate-900">{row.evidence_count}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-slate-500">Acciones registradas</div>
                  <div className="mt-1 font-semibold text-slate-900">{row.actions_count}</div>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
