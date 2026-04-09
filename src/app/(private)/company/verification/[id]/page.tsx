import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import DecisionPanel from "./DecisionPanel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ id: string }>;
};

function fmtDate(v?: string | null) {
  if (!v) return "Pendiente";
  const t = Date.parse(v);
  if (Number.isNaN(t)) return "Pendiente";
  return new Date(t).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusMeta(statusRaw: unknown) {
  const status = String(statusRaw || "").toLowerCase();
  if (status === "verified") {
    return {
      label: "Confirmada",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }
  if (status === "rejected") {
    return {
      label: "Rechazada",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }
  return {
    label: "Pendiente",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  };
}

function confidenceMeta(levelRaw: unknown) {
  const level = String(levelRaw || "").toLowerCase();
  if (level === "high") {
    return {
      label: "Alta",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      helper: "La validación tiene alta fiabilidad y puede aportar confianza al perfil.",
    };
  }
  if (level === "medium") {
    return {
      label: "Media",
      className: "border-amber-200 bg-amber-50 text-amber-800",
      helper: "La validación es útil, pero conviene reforzarla con documentación.",
    };
  }
  if (level === "low") {
    return {
      label: "Baja",
      className: "border-rose-200 bg-rose-50 text-rose-700",
      helper: "La validación no es suficientemente sólida para reforzar el perfil por sí sola.",
    };
  }
  return {
    label: "Sin clasificar",
    className: "border-slate-200 bg-slate-100 text-slate-700",
    helper: "Todavía no hay una señal clara de confianza para esta validación.",
  };
}

export default async function CompanyVerificationDetail({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: au } = await supabase.auth.getUser();
  if (!au.user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_company_id")
    .eq("id", au.user.id)
    .maybeSingle();

  if (!profile?.active_company_id) notFound();

  const { data: requestRow } = await supabase
    .from("verification_requests")
    .select(`
      id,
      status,
      requested_at,
      created_at,
      resolved_at,
      resolution_notes,
      company_id,
      requested_by,
      employment_record_id,
      company_name_snapshot,
      company_name_target,
      company_verification_status_snapshot,
      verification_confidence_level,
      verification_confidence_score,
      trust_score_awarded,
      owner_attention_required,
      verifier_email_domain,
      verifier_company_match_note
    `)
    .eq("id", id)
    .maybeSingle();

  if (!requestRow?.id || !requestRow.company_id) notFound();
  if (String(requestRow.company_id) !== String(profile.active_company_id)) notFound();

  const [{ data: employment }, { data: candidateProfile }, { data: summary }] = await Promise.all([
    requestRow.employment_record_id
      ? supabase
          .from("employment_records")
          .select("id,candidate_id,company_name_freeform,position,start_date,end_date,verification_status,verification_resolved_at")
          .eq("id", requestRow.employment_record_id)
          .maybeSingle()
      : Promise.resolve({ data: null as any }),
    requestRow.requested_by
      ? supabase
          .from("profiles")
          .select("full_name")
          .eq("id", requestRow.requested_by)
          .maybeSingle()
      : Promise.resolve({ data: null as any }),
    supabase
      .from("verification_summary")
      .select("verification_id,status,status_effective,is_revoked,evidence_count,actions_count,created_at")
      .eq("verification_id", id)
      .maybeSingle(),
  ]);

  const effectiveStatus = summary?.is_revoked
    ? "revoked"
    : summary?.status_effective || summary?.status || requestRow.status || "pending_company";

  const status = statusMeta(effectiveStatus);
  const confidence = confidenceMeta(requestRow.verification_confidence_level);

  const companyLabel =
    requestRow.company_name_snapshot ||
    employment?.company_name_freeform ||
    requestRow.company_name_target ||
    "Empresa";

  const candidateName = candidateProfile?.full_name || "Persona candidata";
  const roleLabel = employment?.position || "Puesto pendiente de completar";
  const periodLabel = `${fmtDate(employment?.start_date)} — ${employment?.end_date ? fmtDate(employment?.end_date) : "Actualidad"}`;
  const receivedAt = requestRow.requested_at || requestRow.created_at || summary?.created_at || null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Verificación recibida
          </div>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Validación de experiencia</h1>
          <p className="mt-2 text-sm text-slate-600">
            Revisa qué experiencia te piden confirmar y toma una decisión clara.
          </p>
        </div>

        <Link
          href="/company/requests"
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          ← Volver
        </Link>
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${status.className}`}>
              {status.label}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
              Recibida {fmtDate(receivedAt)}
            </span>
            {requestRow.resolved_at ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                Resuelta {fmtDate(requestRow.resolved_at)}
              </span>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Persona candidata</div>
              <div className="mt-2 text-base font-semibold text-slate-900">{candidateName}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Empresa</div>
              <div className="mt-2 text-base font-semibold text-slate-900">{companyLabel}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Puesto</div>
              <div className="mt-2 text-base font-semibold text-slate-900">{roleLabel}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Periodo</div>
              <div className="mt-2 text-base font-semibold text-slate-900">{periodLabel}</div>
            </div>
          </div>

          <div className={`mt-6 rounded-3xl border p-5 ${String(effectiveStatus || "").toLowerCase() === "verified" ? "border-emerald-200 bg-emerald-50" : String(effectiveStatus || "").toLowerCase() === "rejected" ? "border-rose-200 bg-rose-50" : "border-blue-200 bg-blue-50"}`}>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Decisión</div>
            <p className="mt-2 text-base font-semibold text-slate-900">
              {String(effectiveStatus || "").toLowerCase() === "verified"
                ? "La experiencia ya está confirmada."
                : String(effectiveStatus || "").toLowerCase() === "rejected"
                  ? "La experiencia ya está rechazada."
                  : "Confirma o rechaza esta experiencia."}
            </p>
            <p className="mt-2 text-sm text-slate-700">
              {String(effectiveStatus || "").toLowerCase() === "verified" || String(effectiveStatus || "").toLowerCase() === "rejected"
                ? "Esta decisión ya quedó registrada para el candidato."
                : "Tu decisión quedará registrada para el candidato."}
            </p>
            <div className="mt-5">
              <DecisionPanel verificationRequestId={id} currentStatus={String(effectiveStatus || "")} />
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Qué estás confirmando</div>
            <p className="mt-2 text-sm text-slate-700">
              Te pedimos confirmar si <span className="font-semibold text-slate-900">{candidateName}</span> trabajó en <span className="font-semibold text-slate-900">{companyLabel}</span> como <span className="font-semibold text-slate-900">{roleLabel}</span> durante el periodo indicado.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <details className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">Más contexto</summary>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-4">
                <span>Estado</span>
                <span className="font-semibold text-slate-900">{status.label}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Confianza</span>
                <span className="font-semibold text-slate-900">{confidence.label}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Confianza</span>
                <span className="font-semibold text-slate-900">
                  {confidence.label}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Dominio del email verificador</span>
                <span className="font-semibold text-slate-900">
                  {requestRow.verifier_email_domain || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Evidencias</span>
                <span className="font-semibold text-slate-900">{summary?.evidence_count ?? 0}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Acciones registradas</span>
                <span className="font-semibold text-slate-900">{summary?.actions_count ?? 0}</span>
              </div>
              {requestRow.verifier_company_match_note ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                  {requestRow.verifier_company_match_note}
                </div>
              ) : null}
              {requestRow.owner_attention_required ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Esta validación puede necesitar una revisión adicional antes de darla por cerrada.
                </div>
              ) : null}
              {requestRow.resolution_notes ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  {requestRow.resolution_notes}
                </div>
              ) : null}
              <p className="text-xs text-slate-500">{confidence.helper}</p>
            </div>
          </details>
        </div>
      </section>
    </div>
  );
}
