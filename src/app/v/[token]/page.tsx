import { createClient } from "@/utils/supabase/server"

type PageProps = { params: { token: string } }

export default async function PublicVerificationPage({ params }: PageProps) {

  const supabase = await createClient()

  const { data: verification } = await supabase
    .from("verification_requests")
    .select(`
      id,
      status,
      public_token,
      revoked_at,
      company_name_freeform,
      position,
      start_date,
      end_date,
      candidate_id
    `)
    .eq("public_token", params.token)
    .maybeSingle()

  if (!verification) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="text-3xl font-semibold text-gray-900">
            QR NO VÁLIDO O CADUCADO
          </div>
        </div>
      </main>
    )
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status, full_name")
    .eq("id", verification.candidate_id)
    .maybeSingle()

  const subscriptionActive =
    profile?.subscription_status === "active" ||
    profile?.subscription_status === "trialing"

  const valid_now =
    subscriptionActive &&
    !verification.revoked_at &&
    verification.status === "verified"

  if (!valid_now) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="text-3xl font-semibold text-gray-900">
            QR NO VÁLIDO O CADUCADO
          </div>
        </div>
      </main>
    )
  }

  function fmt(d: string | null) {
    if (!d) return ""
    return new Date(d).getFullYear()
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">

        <div className="text-xs text-gray-500">
          Credencial laboral verificada
        </div>

        <div className="mt-2 text-2xl font-semibold text-gray-900">
          {profile?.full_name || "Profesional verificado"}
        </div>

        <div className="mt-6 border border-gray-200 rounded-2xl p-5">
          <div className="text-sm font-semibold text-gray-900">
            {verification.position || "Experiencia"}
          </div>

          <div className="text-sm text-gray-600">
            {verification.company_name_freeform || "Empresa"}
          </div>

          <div className="mt-1 text-xs text-gray-500">
            {fmt(verification.start_date)} — {verification.end_date ? fmt(verification.end_date) : "Actualidad"}
          </div>

          <div className="mt-3 inline-flex px-3 py-1 rounded-full border text-xs font-semibold bg-green-50 text-green-700 border-green-100">
            ✔ Verificado
          </div>
        </div>

      </div>
    </main>
  )
}
