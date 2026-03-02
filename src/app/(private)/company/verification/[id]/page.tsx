import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/utils/supabase/server";

export default async function CompanyVerificationDetail({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();

  // 1. Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  // 2. Profile (role + active_company_id)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active_company_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "company" || !profile.active_company_id) {
    notFound();
  }

  // 3. Fetch verification summary
  const { data: summary } = await supabase
    .from("verification_summary")
    .select("*")
    .eq("verification_id", params.id)
    .maybeSingle();

  if (!summary) notFound();

  // 4. HARD GUARD → company ownership
  if (summary.company_id !== profile.active_company_id) {
    notFound();
  }

  const statusEffective =
    summary.is_revoked
      ? "revoked"
      : summary.status_effective || summary.status;

  function statusBadge(status: string) {
    const map: Record<string, string> = {
      approved: "bg-green-100 text-green-800",
      verified: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
      pending: "bg-yellow-100 text-yellow-800",
      revoked: "bg-gray-200 text-gray-800",
    };
    return map[status] || "bg-gray-100 text-gray-700";
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Detalle de verificación
        </h1>
        <Link
          href="/company/requests"
          className="text-sm underline text-gray-600"
        >
          ← Volver a solicitudes
        </Link>
      </div>

      <div className="border rounded-xl p-6 space-y-4 shadow-sm bg-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500">
              Empresa
            </div>
            <div className="font-medium">
              {summary.company_name_freeform}
            </div>
          </div>

          <span
            className={`px-3 py-1 text-xs font-medium rounded-full ${statusBadge(
              statusEffective
            )}`}
          >
            {statusEffective?.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500">Posición</div>
            <div>{summary.position}</div>
          </div>
          <div>
            <div className="text-gray-500">Periodo</div>
            <div>
              {summary.start_date} — {summary.end_date || "Actual"}
            </div>
          </div>
        </div>
      </div>

      {summary.is_revoked && (
        <div className="border border-gray-300 bg-gray-50 rounded-xl p-4 space-y-2">
          <div className="font-semibold text-gray-800">
            Verificación revocada
          </div>
          <div className="text-sm text-gray-600">
            Motivo: {summary.revoked_reason || "No especificado"}
          </div>
          <div className="text-xs text-gray-500">
            Revocada en: {summary.revoked_at}
          </div>
        </div>
      )}

      <div className="flex gap-4">
        <Link
          href={`/api/verification/${params.id}/summary`}
          className="text-sm underline"
        >
          Ver JSON resumen
        </Link>

        <Link
          href={`/company/verification/${params.id}/evidences`}
          className="text-sm underline"
        >
          Ver evidencias
        </Link>
      </div>
    </div>
  );
}
