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
  if (!v) return "No disponible";
  const t = Date.parse(v);
  if (Number.isNaN(t)) return "No disponible";
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

  const candidateName = candidateProfile?.full_name || "Candidato";
  const roleLabel = employment?.position || "Puesto no especificado";
  const periodLabel = `${fmtDate(employment?.start_date)} — ${employment?.end_date ? fmtDate(employment?.end_date) : "Actualidad"}`;
  const receivedAt = requestRow.requested_at || requestRow.created_at || summary?.created_at || null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Solicitud de validación
          </div>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Detalle de validación</h1>
          <p className="mt-2 text-sm text-slate-600">
            Revisa el estado, la confianza de la validación y decide si necesitas documentación adicional.
          </p>
        </div>

        <Link
          href="/company/requests"
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          ← Volver
        </Link>
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${status.className}`}>
              {status.label}
            </span>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${confidence.className}`}>
              Confianza {confidence.label}
            </span>
            {Number(requestRow.trust_score_awarded || 0) > 0 ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                +{requestRow.trust_score_awarded} puntos de confianza
              </span>
            ) : (
              <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                No suma confianza
              </span>
            )}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Candidato</div>
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

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Recibida</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{fmtDate(receivedAt)}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Resuelta</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{fmtDate(requestRow.resolved_at)}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Evidencias</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{summary?.evidence_count ?? 0}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Acciones</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{summary?.actions_count ?? 0}</div>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Señal de confianza</div>
              <p className="mt-2 text-sm text-slate-600">{confidence.helper}</p>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">Dominio del verificador</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {requestRow.verifier_email_domain || "No disponible"}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">Score de confianza</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {requestRow.verification_confidence_score ?? 0}/100
                  </div>
                </div>
              </div>

              {requestRow.verifier_company_match_note ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
                  {requestRow.verifier_company_match_note}
                </div>
              ) : null}
            </div>

            {requestRow.owner_attention_required ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-sm font-semibold text-amber-900">Revisión manual recomendada</div>
                <p className="mt-2 text-sm text-amber-800">
                  Esta validación necesita una revisión adicional. Conviene pedir documentación antes de darla por consolidada.
                </p>
              </div>
            ) : null}

            {String(requestRow.verification_confidence_level || "").toLowerCase() !== "high" ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Siguiente paso recomendado</div>
                <p className="mt-2 text-sm text-slate-600">
                  Solicita documentación para reforzar esta experiencia y mejorar su calidad probatoria.
                </p>
              </div>
            ) : null}

            {requestRow.resolution_notes ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Notas de resolución</div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                  {requestRow.resolution_notes}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">Acción</div>
            <p className="mt-2 text-sm text-slate-600">
              Confirma o rechaza esta experiencia. La resolución quedará registrada para el candidato y para tu equipo.
            </p>

            <div className="mt-5">
              <DecisionPanel verificationRequestId={id} currentStatus={String(effectiveStatus || "")} />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">Resumen rápido</div>
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
                <span>Trust score</span>
                <span className="font-semibold text-slate-900">
                  {Number(requestRow.trust_score_awarded || 0) > 0
                    ? `+${requestRow.trust_score_awarded}`
                    : "0"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Dominio</span>
                <span className="font-semibold text-slate-900">
                  {requestRow.verifier_email_domain || "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
