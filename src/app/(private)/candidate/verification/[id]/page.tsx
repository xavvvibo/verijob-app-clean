import { createClient } from "@/utils/supabase/server";

function toEsDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function mapStatus(statusRaw: unknown, revokedAt?: string | null) {
  if (revokedAt) return "Revocada";
  const status = String(statusRaw || "").toLowerCase();
  if (status === "verified" || status === "approved") return "Verificada por empresa vía email corporativo";
  if (status === "pending_company") return "Pendiente de respuesta de empresa";
  if (status === "reviewing") return "En revisión";
  if (status === "rejected") return "Rechazada";
  if (status === "revoked") return "Revocada";
  return "En verificación";
}

function mapCompanyVerificationStatus(statusRaw: unknown) {
  const status = String(statusRaw || "").toLowerCase();
  if (status === "registered_in_verijob") return "Empresa registrada en VERIJOB";
  if (status === "verified_paid") return "Empresa verificada (suscripción activa)";
  if (status === "verified_document") return "Empresa verificadora validada documentalmente";
  if (status === "unverified_external") return "Verificación por email corporativo";
  if (status === "unverified") return "Empresa no verificada";
  return "Estado de empresa no disponible";
}

export default async function CandidateVerificationPage(props: any) {
  const params = await props?.params;
  const id = params?.id as string | undefined;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !id) return null;

  const { data: vr } = await supabase
    .from("verification_requests")
    .select("id,status,verification_channel,request_context,revoked_at,requested_by,requested_at,created_at,updated_at,resolved_at,resolution_notes,company_name_target,company_name_snapshot,company_verification_status_snapshot,employment_record_id")
    .eq("id", id)
    .maybeSingle();

  if (!vr || vr.requested_by !== user.id) {
    return (
      <div className="p-8">
        <div className="text-xl font-semibold">No encontramos esa página</div>
      </div>
    );
  }

  const { data: er } = vr.employment_record_id
    ? await supabase
        .from("employment_records")
        .select("position,company_name_freeform,start_date,end_date,verification_status,description")
        .eq("id", vr.employment_record_id)
        .maybeSingle()
    : { data: null as any };

  const { data: evidences } = await supabase
    .from("evidences")
    .select("id,evidence_type,created_at")
    .eq("verification_request_id", vr.id)
    .order("created_at", { ascending: false });

  const { data: cp } = await supabase
    .from("candidate_profiles")
    .select("trust_score")
    .eq("user_id", user.id)
    .maybeSingle();

  const statusLabel = mapStatus(vr.status, vr.revoked_at);
  const companyVerificationLabel = mapCompanyVerificationStatus(vr.company_verification_status_snapshot);
  const companyName = vr.company_name_snapshot || er?.company_name_freeform || vr.company_name_target || "Empresa";
  const evidenceRows = Array.isArray(evidences) ? evidences : [];

  return (
    <div className="p-8 space-y-6">
      <div className="bg-white border border-gray-200 rounded-3xl p-7">
        <div className="text-xs text-gray-500">Solicitud de verificación</div>
        <div className="mt-2 text-2xl font-semibold text-gray-900">
          {er?.position || "Experiencia"} · {companyName}
        </div>

        <div className="mt-4 flex items-center gap-3">
          {statusLabel === "Revocada" ? (
            <span className="inline-flex px-3 py-1 rounded-full border text-xs font-semibold bg-red-50 text-red-700 border-red-100">
              Revocada
            </span>
          ) : (
            <span className="inline-flex px-3 py-1 rounded-full border text-xs font-semibold bg-gray-50 text-gray-700 border-gray-200">
              {statusLabel}
            </span>
          )}
          <span className="text-sm text-gray-600">{toEsDate(vr.requested_at)} · {toEsDate(vr.resolved_at)}</span>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="border border-gray-200 rounded-2xl p-4">
            <div className="text-xs text-gray-500">Periodo laboral</div>
            <div className="mt-1 text-sm font-semibold text-gray-900">
              {toEsDate(er?.start_date)} — {er?.end_date ? toEsDate(er.end_date) : "Actualidad"}
            </div>
          </div>
          <div className="border border-gray-200 rounded-2xl p-4">
            <div className="text-xs text-gray-500">Estado empresa emisora</div>
            <div className="mt-1 text-sm font-semibold text-gray-900">{companyVerificationLabel}</div>
          </div>
          <div className="border border-gray-200 rounded-2xl p-4">
            <div className="text-xs text-gray-500">Trust (perfil global)</div>
            <div className="mt-1 text-xl font-semibold text-gray-900">{cp?.trust_score ?? 0}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="border border-gray-200 rounded-2xl p-4">
            <div className="text-xs text-gray-500">Canal</div>
            <div className="mt-1 text-sm font-semibold text-gray-900">{vr.verification_channel || "email"}</div>
          </div>
          <div className="border border-gray-200 rounded-2xl p-4">
            <div className="text-xs text-gray-500">Creada</div>
            <div className="mt-1 text-sm font-semibold text-gray-900">{toEsDate(vr.requested_at || vr.created_at)}</div>
          </div>
          <div className="border border-gray-200 rounded-2xl p-4">
            <div className="text-xs text-gray-500">Última actualización</div>
            <div className="mt-1 text-sm font-semibold text-gray-900">{toEsDate(vr.updated_at || vr.resolved_at)}</div>
          </div>
        </div>

        {er?.description ? (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            <span className="font-semibold text-gray-900">Descripción de la experiencia: </span>
            {er.description}
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-sm font-semibold text-gray-900">Evidencias asociadas</div>
          {evidenceRows.length > 0 ? (
            <ul className="mt-2 space-y-2 text-sm text-gray-700">
              {evidenceRows.map((ev: any) => (
                <li key={ev.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                  <span>{String(ev.evidence_type || "Documento")}</span>
                  <span className="text-xs text-gray-500">{toEsDate(ev.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-gray-600">No hay evidencias documentales vinculadas a esta solicitud todavía.</p>
          )}
        </div>

        {vr.resolution_notes ? (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            <span className="font-semibold text-gray-900">Notas de resolución: </span>
            {vr.resolution_notes}
          </div>
        ) : null}

        {vr.request_context ? (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            <span className="font-semibold text-gray-900">Contexto de solicitud: </span>
            {typeof vr.request_context === "string"
              ? vr.request_context
              : JSON.stringify(vr.request_context)}
          </div>
        ) : null}

        <div className="mt-4 text-sm text-gray-600">
          Esta solicitud aplica a una experiencia laboral concreta. El resultado no certifica todo el CV ni todo el perfil.
        </div>
      </div>
    </div>
  );
}
