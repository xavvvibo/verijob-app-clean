import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RequestStatus =
  | "requested"
  | "reviewing"
  | "company_registered_pending"
  | "verified"
  | "rejected"
  | "revoked"
  | "unknown";

function normalizeStatus(status: string | null): RequestStatus {
  const s = String(status || "").toLowerCase();
  if (s === "requested") return "requested";
  if (s === "reviewing") return "reviewing";
  if (s === "company_registered_pending") return "company_registered_pending";
  if (s === "verified" || s === "approved") return "verified";
  if (s === "rejected") return "rejected";
  if (s === "revoked") return "revoked";
  return "unknown";
}

function statusLabel(status: RequestStatus) {
  if (status === "requested") return "En verificación";
  if (status === "reviewing") return "En verificación";
  if (status === "company_registered_pending") return "Empresa registrada (pendiente)";
  if (status === "verified") return "Verificado";
  if (status === "rejected") return "Rechazada";
  if (status === "revoked") return "Revocada";
  return "En verificación";
}

function statusTone(status: RequestStatus) {
  if (status === "verified") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected" || status === "revoked") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "company_registered_pending") return "border-indigo-200 bg-indigo-50 text-indigo-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function toEsDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function periodLabel(startDate: string | null | undefined, endDate: string | null | undefined) {
  return `${toEsDate(startDate)} — ${endDate ? toEsDate(endDate) : "Actualidad"}`;
}

export default async function CandidateVerificationsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();
  if (!au.user) redirect("/login");

  const { data: rows } = await supabase
    .from("verification_requests")
    .select("id,status,created_at,requested_at,resolved_at,company_name_target,employment_records(position,company_name_freeform,start_date,end_date)")
    .eq("requested_by", au.user.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h2 className="text-xl font-semibold">Solicitudes de verificación por experiencia</h2>
      <p className="mt-2 text-sm text-gray-600">
        Aquí puedes seguir el estado de cada experiencia laboral enviada a verificación.
      </p>

      <div className="mt-6">
        <Link
          className="inline-flex rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          href="/candidate/verifications/new"
        >
          Nueva solicitud
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        {(rows || []).length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
            Aún no has enviado solicitudes de verificación.
          </div>
        ) : (
          (rows || []).map((r: any) => {
            const employment = Array.isArray(r.employment_records) ? r.employment_records[0] : r.employment_records;
            const normalized = normalizeStatus(r.status);
            const reminderEnabled = normalized === "requested" || normalized === "reviewing" || normalized === "company_registered_pending";

            return (
              <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      {employment?.position || "Puesto no especificado"} · {employment?.company_name_freeform || r.company_name_target || "Empresa"}
                    </div>
                    <div className="mt-1 text-xs text-gray-600">
                      Periodo: {periodLabel(employment?.start_date, employment?.end_date)}
                    </div>
                    <div className="mt-1 text-xs text-gray-600">
                      Enviada: {toEsDate(r.requested_at || r.created_at)} · Última actualización: {toEsDate(r.resolved_at || r.created_at)}
                    </div>
                    {reminderEnabled ? (
                      <div className="mt-1 text-xs text-amber-700">Recordatorio disponible</div>
                    ) : null}
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(normalized)}`}>
                    {statusLabel(normalized)}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!reminderEnabled}
                    className="inline-flex rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 disabled:opacity-40"
                  >
                    Reenviar solicitud
                  </button>
                  <Link
                    href={`/candidate/verification/${r.id}`}
                    className="inline-flex rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
                  >
                    Ver detalle
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
