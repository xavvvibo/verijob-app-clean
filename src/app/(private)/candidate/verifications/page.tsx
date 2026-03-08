import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function mapStatus(status: string | null) {
  const s = String(status || "").toLowerCase();
  if (s.includes("revoked")) return "Revocada";
  if (s.includes("verified") || s.includes("approved")) return "Aceptada";
  if (s.includes("rejected")) return "Rechazada";
  if (s.includes("modified") || s.includes("clarif")) return "Modificada";
  if (s.includes("waiting")) return "Esperando respuesta";
  return "Enviada";
}

export default async function CandidateVerificationsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();
  if (!au.user) redirect("/login");

  const { data: rows } = await supabase
    .from("verification_requests")
    .select("id,status,created_at,submitted_at,resolved_at,employment_records(position,company_name_freeform)")
    .eq("requested_by", au.user.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h2 className="text-xl font-semibold">Solicitudes de verificación</h2>
      <p className="mt-2 text-sm text-gray-600">
        Gestiona tus solicitudes, su estado y los próximos pasos.
      </p>

      <div className="mt-6">
        <Link
          className="inline-flex rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          href="/candidate/verifications/new"
        >
          Nueva verificación
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        {(rows || []).length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
            Aún no hay solicitudes de verificación.
          </div>
        ) : (
          (rows || []).map((r: any) => {
            const employment = Array.isArray(r.employment_records) ? r.employment_records[0] : r.employment_records;
            const status = mapStatus(r.status);
            const reminderEnabled = status === "Enviada" || status === "Esperando respuesta";

            return (
              <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      {employment?.position || "Puesto"} · {employment?.company_name_freeform || "Empresa"}
                    </div>
                    <div className="mt-1 text-xs text-gray-600">
                      Estado: {status} · Alta: {r.submitted_at || r.created_at || "—"}
                    </div>
                    {reminderEnabled ? (
                      <div className="mt-1 text-xs text-amber-700">Recordatorio disponible</div>
                    ) : null}
                  </div>
                  <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700">
                    {status}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!reminderEnabled}
                    className="inline-flex rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 disabled:opacity-40"
                  >
                    Enviar recordatorio
                  </button>
                  <button
                    type="button"
                    disabled={status !== "Modificada"}
                    className="inline-flex rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 disabled:opacity-40"
                  >
                    Aceptar modificación
                  </button>
                  <Link
                    href={`/candidate/verification/${r.id}`}
                    className="inline-flex rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
                  >
                    Registrar verificación
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
