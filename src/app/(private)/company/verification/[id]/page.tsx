import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import DecisionPanel from "./DecisionPanel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ id: string }>;
};

function badge(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "revoked") return "bg-gray-200 text-gray-800";
  if (s.includes("approved") || s.includes("verified")) return "bg-green-100 text-green-800";
  if (s.includes("rejected")) return "bg-red-100 text-red-800";
  if (s.includes("pending_company") || s.includes("pending") || s.includes("review")) return "bg-yellow-100 text-yellow-800";
  return "bg-gray-100 text-gray-700";
}

function requestStatusLabel(statusRaw: unknown) {
  const status = String(statusRaw || "").toLowerCase();
  if (status === "verified") return "Verificada";
  if (status === "rejected") return "Rechazada";
  if (status === "revoked") return "Revocada";
  if (status === "pending_company") return "Empresa registrada (pendiente)";
  if (status === "pending_company" || status === "reviewing") return "En revisión";
  return "Sin estado";
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const t = Date.parse(v);
  if (Number.isNaN(t)) return v;
  return new Date(t).toLocaleDateString("es-ES");
}

function verificationStatusLabel(statusRaw: unknown) {
  const status = String(statusRaw || "").toLowerCase();
  if (status === "verified_paid") return "Empresa verificada (suscripción activa)";
  if (status === "verified_document") return "Empresa verificada por documentación";
  return "Empresa no verificada";
}

function verificationStatusClass(statusRaw: unknown) {
  const status = String(statusRaw || "").toLowerCase();
  if (status === "verified_paid") return "bg-emerald-100 text-emerald-800";
  if (status === "verified_document") return "bg-blue-100 text-blue-800";
  return "bg-amber-100 text-amber-800";
}

async function resolveCompanyVerificationStatus(supabase: any, companyId: string, userId: string) {
  const subRes = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const subscriptionStatus = String(subRes.data?.status || "").toLowerCase();
  if (subscriptionStatus === "active" || subscriptionStatus === "trialing") return "verified_paid";

  const companyRes = await supabase
    .from("companies")
    .select("company_verification_status")
    .eq("id", companyId)
    .maybeSingle();
  if (!companyRes.error && companyRes.data?.company_verification_status) {
    return String(companyRes.data.company_verification_status);
  }

  const profileRes = await supabase
    .from("company_profiles")
    .select("company_verification_status")
    .eq("company_id", companyId)
    .maybeSingle();
  if (!profileRes.error && profileRes.data?.company_verification_status) {
    return String(profileRes.data.company_verification_status);
  }

  return "unverified";
}

function mapRequestStatusToDisplay(statusRaw: unknown) {
  const status = String(statusRaw || "").toLowerCase();
  if (status === "verified") return "verified";
  if (status === "rejected") return "rejected";
  if (status === "revoked") return "revoked";
  if (status === "pending_company") return "pending_company";
  if (status === "pending_company" || status === "reviewing") return "reviewing";
  return status || "unknown";
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
    .select("id,status,requested_at,resolved_at,resolution_notes,company_name_snapshot,company_verification_status_snapshot,employment_record_id,company_id,requested_by")
    .eq("id", id)
    .maybeSingle();

  if (!requestRow?.id || !requestRow.company_id) notFound();

  if (String(requestRow.company_id) !== String(profile.active_company_id)) {
    notFound();
  }

  const { data: employment } = requestRow.employment_record_id
    ? await supabase
        .from("employment_records")
        .select("id,candidate_id,company_name_freeform,position,start_date,end_date,verification_status,verification_resolved_at")
        .eq("id", requestRow.employment_record_id)
        .maybeSingle()
    : { data: null as any };

  const { data: candidateProfile } = requestRow.requested_by
    ? await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", requestRow.requested_by)
        .maybeSingle()
    : { data: null as any };

  const { data: summary } = await supabase
    .from("verification_summary")
    .select("verification_id,status,status_effective,is_revoked,evidence_count,actions_count,created_at")
    .eq("verification_id", id)
    .maybeSingle();

  const companyVerificationStatus = await resolveCompanyVerificationStatus(
    supabase,
    profile.active_company_id,
    au.user.id
  );

  const statusEffective = summary?.is_revoked
    ? "revoked"
    : mapRequestStatusToDisplay(summary?.status_effective || summary?.status || requestRow.status);

  const companyLabel =
    requestRow.company_name_snapshot ||
    employment?.company_name_freeform ||
    "Empresa";

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Detalle de solicitud de verificación</h1>
          <div className="text-sm text-gray-500">Código interno: {id}</div>
        </div>

        <Link href="/company/requests" className="text-sm underline text-gray-700">
          ← Volver
        </Link>
      </div>

      <div className="border rounded-xl p-6 shadow-sm bg-white space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm text-gray-500">Verificación emitida por</div>
            <div className="font-medium truncate">{companyLabel}</div>
            <div className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${verificationStatusClass(companyVerificationStatus)}`}>
              {verificationStatusLabel(companyVerificationStatus)}
            </div>
            <div className="mt-2 text-sm text-gray-600">
              <span className="font-medium text-gray-800">Experiencia:</span> {employment?.position || "Puesto no especificado"}
            </div>
            <div className="mt-1 text-sm text-gray-600">
              <span className="font-medium text-gray-800">Candidato:</span> {candidateProfile?.full_name || requestRow.requested_by || "Candidato"}
            </div>
            <div className="mt-1 text-sm text-gray-600">
              <span className="font-medium text-gray-800">Acción esperada:</span> confirma o rechaza si esta persona trabajó en ese periodo.
            </div>
          </div>

          <span className={`shrink-0 px-3 py-1 text-xs font-medium rounded-full ${badge(statusEffective)}`}>
            {requestStatusLabel(statusEffective)}
          </span>
        </div>

        <div className="rounded-lg border p-3 text-sm">
          <div className="text-gray-500">Estado de la solicitud</div>
          <div className="mt-1 text-gray-800">
            Enviada: {fmtDate(requestRow.requested_at || summary?.created_at || null)} ·
            Resuelta: {fmtDate(requestRow.resolved_at || null)}
          </div>
          <p className="mt-2 text-xs text-gray-600">
            Esta validación solo afecta a esta experiencia laboral concreta. No valida el perfil completo del candidato.
          </p>
          {requestRow.resolution_notes ? (
            <div className="mt-2 text-gray-700">
              <span className="font-medium text-gray-800">Notas:</span> {requestRow.resolution_notes}
            </div>
          ) : null}
        </div>

        {requestRow.company_verification_status_snapshot ? (
          <div className="rounded-lg border p-3 text-sm">
            <div className="text-gray-500">Snapshot de empresa al resolver</div>
            <div className="mt-1 text-gray-800">
              {requestRow.company_name_snapshot || companyLabel} ·{" "}
              {verificationStatusLabel(requestRow.company_verification_status_snapshot)}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="rounded-lg border p-3">
            <div className="text-gray-500">Periodo</div>
            <div className="mt-1">{fmtDate(employment?.start_date)} — {employment?.end_date ? fmtDate(employment?.end_date) : "Actual"}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-gray-500">Evidencias</div>
            <div className="mt-1 font-medium">{summary?.evidence_count ?? 0}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-gray-500">Acciones</div>
            <div className="mt-1 font-medium">{summary?.actions_count ?? 0}</div>
          </div>
        </div>

        {summary?.is_revoked ? (
          <div className="rounded-xl border border-gray-300 bg-gray-50 p-4 space-y-1">
            <div className="text-sm font-semibold text-gray-900">Verificación revocada</div>
            <div className="text-sm text-gray-700">
              Esta experiencia se marcó como revocada y ya no computa como validación activa.
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 pt-2">
          <a className="text-sm underline text-blue-700" href={`/api/verification/${id}/summary`} target="_blank" rel="noreferrer">
            Ver JSON resumen
          </a>
        </div>

        <DecisionPanel verificationRequestId={id} currentStatus={statusEffective} />
      </div>
    </div>
  );
}
