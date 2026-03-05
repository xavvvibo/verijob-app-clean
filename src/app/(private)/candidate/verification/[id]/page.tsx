import { createClient } from "@/utils/supabase/server"

export default async function CandidateVerificationPage(props: any) {
  const params = await props?.params
  const id = params?.id as string | undefined

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !id) return null

  // 1) ownership + token desde verification_requests
  const { data: vr } = await supabase
    .from("verification_requests")
    .select("id, status, revoked_at, public_token, requested_by")
    .eq("id", id)
    .maybeSingle()

  if (!vr || vr.requested_by !== user.id) {
    return (
      <div className="p-8">
        <div className="text-xl font-semibold">No encontramos esa página</div>
      </div>
    )
  }

  // 2) detalle UI desde verification_summary (es donde están position/company/evidences)
  const { data: vs } = await supabase
    .from("verification_summary")
    .select("*")
    .eq("verification_id", id)
    .maybeSingle()

  const title =
    vs?.position
      ? `${vs.position} · ${vs.company_name_freeform || "Empresa"}`
      : `Verificación · ${id}`

  const statusLabel = vs?.is_revoked || vr.revoked_at ? "Revocada" : (vs?.status || vr.status || "—")

  const publicUrl = vr.public_token ? `https://app.verijob.es/v/${vr.public_token}` : null

  return (
    <div className="p-8 space-y-6">
      <div className="bg-white border border-gray-200 rounded-3xl p-7">
        <div className="text-xs text-gray-500">Verificación</div>
        <div className="mt-2 text-2xl font-semibold text-gray-900">{title}</div>

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

          {publicUrl ? (
            <a className="text-sm font-semibold text-blue-600 hover:text-blue-700" href={publicUrl} target="_blank">
              Abrir CV público
            </a>
          ) : (
            <span className="text-sm text-gray-400">CV público pendiente</span>
          )}
        </div>

        {vs ? (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="border border-gray-200 rounded-2xl p-4">
              <div className="text-xs text-gray-500">Evidencias</div>
              <div className="mt-1 text-xl font-semibold text-gray-900">{vs.evidence_count ?? 0}</div>
            </div>
            <div className="border border-gray-200 rounded-2xl p-4">
              <div className="text-xs text-gray-500">Acciones</div>
              <div className="mt-1 text-xl font-semibold text-gray-900">{vs.actions_count ?? 0}</div>
            </div>
            <div className="border border-gray-200 rounded-2xl p-4">
              <div className="text-xs text-gray-500">Trust</div>
              <div className="mt-1 text-xl font-semibold text-gray-900">{vs.trust_score ?? 0}</div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
