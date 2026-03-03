import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

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
  if (s.includes("pending") || s.includes("review")) return "bg-yellow-100 text-yellow-800";
  return "bg-gray-100 text-gray-700";
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const t = Date.parse(v);
  if (Number.isNaN(t)) return v;
  return new Date(t).toLocaleDateString("es-ES");
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

  const { data: summary } = await supabase
    .from("verification_summary")
    .select("*")
    .eq("verification_id", id)
    .maybeSingle();

  if (!summary) notFound();

  // HARD GUARD: si no pertenece a la empresa activa -> 404 real (sin redirect)
  if (summary.company_id !== profile.active_company_id) notFound();

  const statusEffective = summary.is_revoked
    ? "revoked"
    : (summary.status_effective || summary.status || "unknown");

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Detalle de verificación</h1>
          <div className="text-sm text-gray-500">VID: {id}</div>
        </div>

        <Link href="/company/requests" className="text-sm underline text-gray-700">
          ← Volver
        </Link>
      </div>

      <div className="border rounded-xl p-6 shadow-sm bg-white space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm text-gray-500">Empresa</div>
            <div className="font-medium truncate">{summary.company_name_freeform || "—"}</div>
            <div className="mt-2 text-sm text-gray-600">
              <span className="font-medium text-gray-800">Posición:</span> {summary.position || "—"}
            </div>
          </div>

          <span className={`shrink-0 px-3 py-1 text-xs font-medium rounded-full ${badge(statusEffective)}`}>
            {String(statusEffective).toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="rounded-lg border p-3">
            <div className="text-gray-500">Periodo</div>
            <div className="mt-1">{fmtDate(summary.start_date)} — {summary.end_date ? fmtDate(summary.end_date) : "Actual"}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-gray-500">Evidencias</div>
            <div className="mt-1 font-medium">{summary.evidence_count ?? 0}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-gray-500">Acciones</div>
            <div className="mt-1 font-medium">{summary.actions_count ?? 0}</div>
          </div>
        </div>

        {summary.is_revoked ? (
          <div className="rounded-xl border border-gray-300 bg-gray-50 p-4 space-y-1">
            <div className="text-sm font-semibold text-gray-900">Verificación revocada</div>
            <div className="text-sm text-gray-700">
              <span className="text-gray-500">Motivo:</span> {summary.revoked_reason || "—"}
            </div>
            <div className="text-sm text-gray-700">
              <span className="text-gray-500">Revocada el:</span> {fmtDate(summary.revoked_at)}
            </div>
            <div className="text-sm text-gray-700">
              <span className="text-gray-500">Revocada por:</span> {summary.revoked_by || "—"}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 pt-2">
          <a className="text-sm underline text-blue-700" href={`/api/verification/${id}/summary`} target="_blank" rel="noreferrer">
            Ver JSON resumen
          </a>

          <Link className="text-sm underline text-blue-700" href={`/company/verification/${id}/evidences`}>
            Ver evidencias
          </Link>
        </div>
      </div>
    </div>
  );
}
