import { createClient } from "@/utils/supabase/server"

export default async function PublicVerificationPage(props: any) {
  const params = await props?.params
  const token = params?.token as string | undefined

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="text-3xl font-semibold text-gray-900">QR NO VÁLIDO O CADUCADO</div>
        </div>
      </main>
    )
  }

  const supabase = await createClient()

  const { data: verification } = await supabase
    .from("verification_requests")
    .select("id,status,public_token,revoked_at,company_id,employment_record_id")
    .eq("public_token", token)
    .maybeSingle()

  // Si no existe o está revocada o no está verificada => QR no válido (sin explicar por qué)
  const valid_now = !!verification && !verification.revoked_at && verification.status === "verified"

  if (!valid_now) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="text-3xl font-semibold text-gray-900">QR NO VÁLIDO O CADUCADO</div>
        </div>
      </main>
    )
  }

  // Vista mínima (el detalle “pro” ya lo muestra vuestra UI pública existente en /v/<token>)
  return (
    <main className="min-h-screen flex items-center justify-center bg-white p-6">
      <div className="max-w-xl w-full bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">
        <div className="text-xs text-gray-500">Verificación profesional</div>
        <div className="mt-3 text-2xl font-semibold text-gray-900">Verificado</div>
      </div>
    </main>
  )
}
