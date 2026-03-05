import { createClient } from "@/utils/supabase/server"

export default async function CandidateVerificationPage(props: any) {
  const params = await props?.params
  const id = params?.id as string | undefined

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !id) return null

  const { data: vr } = await supabase
    .from("verification_requests")
    .select("id,status,revoked_at,public_token,employment_record_id,company_name_freeform,position,start_date,end_date")
    .eq("id", id)
    .maybeSingle()

  if (!vr) {
    return (
      <div className="p-8">
        <div className="text-xl font-semibold">No encontramos esa página</div>
      </div>
    )
  }

  const { data: er } = await supabase
    .from("employment_records")
    .select("candidate_id")
    .eq("id", vr.employment_record_id)
    .maybeSingle()

  if (!er || er.candidate_id !== user.id) {
    return (
      <div className="p-8">
        <div className="text-xl font-semibold">No encontramos esa página</div>
      </div>
    )
  }

  const token = vr.public_token
  const publicUrl = token ? `https://app.verijob.es/v/${token}` : null

  function fmt(d: string | null) {
    if (!d) return "—"
    try { return new Date(d).toISOString().slice(0,10) } catch { return d }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="bg-white border border-gray-200 rounded-3xl p-7">
        <div className="text-xs text-gray-500">Verificación</div>
        <div className="mt-2 text-2xl font-semibold text-gray-900">
          {(vr.position || "Puesto")} · {(vr.company_name_freeform || "Empresa")}
        </div>
        <div className="mt-2 text-sm text-gray-600">
          {fmt(vr.start_date)} — {vr.end_date ? fmt(vr.end_date) : "Actualidad"}
        </div>
        <div className="mt-4 flex items-center gap-2">
          {vr.revoked_at ? (
            <span className="inline-flex px-3 py-1 rounded-full border text-xs font-semibold bg-red-50 text-red-700 border-red-100">
              Revocada
            </span>
          ) : (
            <span className="inline-flex px-3 py-1 rounded-full border text-xs font-semibold bg-gray-50 text-gray-700 border-gray-200">
              {vr.status || "—"}
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
      </div>
    </div>
  )
}
