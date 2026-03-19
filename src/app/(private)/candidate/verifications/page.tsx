import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import DeleteVerificationInlineButton from "./DeleteVerificationInlineButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function statusLabel(status: string | null | undefined) {
  const raw = String(status || "").toLowerCase();
  if (raw === "pending_company") return "Pendiente de respuesta de empresa";
  if (raw === "reviewing") return "En revisión";
  if (raw === "verified") return "Verificada por empresa vía email corporativo";
  if (raw === "rejected") return "Rechazada";
  if (raw === "revoked") return "Revocada";
  return "Desconocido";
}

function companySignalLabel(status: string | null | undefined) {
  const raw = String(status || "").toLowerCase();
  if (raw === "registered_in_verijob") return "Empresa registrada en VERIJOB";
  if (raw === "verified_document") return "Empresa verificadora validada documentalmente";
  if (raw === "verified_paid") return "Empresa con plan activo";
  if (raw === "unverified_external") return "Verificación por email corporativo";
  return "Sin señal adicional";
}

function fmt(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function CandidateVerificationsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();
  if (!au.user) redirect("/login?next=/candidate/verifications");

  const { data: rows, error } = await supabase
    .from("verification_requests")
    .select(
      "id,status,revoked_at,verification_channel,requested_at,created_at,company_name_target,company_email_target,external_email_target,request_context,company_verification_status_snapshot",
    )
    .eq("requested_by", au.user.id)
    .order("requested_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false });
  const visibleRows = (rows || []).filter((row: any) => {
    const status = String(row?.status || "").toLowerCase();
    return !row?.revoked_at && status !== "revoked";
  });

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Verificaciones</h1>
        <p className="mt-1 text-sm text-slate-600">Aquí verás todas tus solicitudes de verificación enviadas a empresas.</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          No se han podido cargar tus verificaciones: {error.message}
        </div>
      ) : null}

      {!error && (!visibleRows || visibleRows.length === 0) ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Aún no tienes solicitudes. Crea la primera desde{" "}
          <Link href="/candidate/experience" className="font-semibold text-blue-700 hover:underline">
            Experiencias
          </Link>
          .
        </div>
      ) : null}

      {!error && visibleRows && visibleRows.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Empresa</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Canal</th>
                <th className="px-4 py-3 font-semibold">Señal empresa</th>
                <th className="px-4 py-3 font-semibold">Fecha</th>
                <th className="px-4 py-3 font-semibold">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.map((row: any) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-slate-900">
                    <div className="font-medium">{row.company_name_target || "Empresa"}</div>
                    <div className="text-xs text-slate-500">{row.company_email_target || row.external_email_target || "Sin email"}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{statusLabel(row.status)}</td>
                  <td className="px-4 py-3 text-slate-700">{row.verification_channel || "email"}</td>
                  <td className="px-4 py-3 text-slate-700">{companySignalLabel(row.company_verification_status_snapshot)}</td>
                  <td className="px-4 py-3 text-slate-700">{fmt(row.requested_at || row.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/candidate/verification?verification_request_id=${encodeURIComponent(row.id)}`}
                        className="text-blue-700 hover:underline"
                      >
                        Ver detalle
                      </Link>
                      <DeleteVerificationInlineButton verificationId={String(row.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
