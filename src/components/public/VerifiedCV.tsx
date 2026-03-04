type Props = {
  data: any
}

function labelStatus(status?: string) {
  const s = (status || "").toLowerCase()
  if (s === "approved" || s === "verified") return "Verificado"
  if (s === "revoked") return "Revocado"
  if (s === "rejected") return "Rechazado"
  if (s === "reviewing") return "En revisión"
  if (s === "pending") return "Pendiente"
  return status || "unknown"
}

export default function VerifiedCV({ data }: Props) {
  const verification = data?.verification || {}
  const metrics = data?.metrics || {}

  const evidenceCount = Number(metrics.evidence_count ?? verification.evidence_count ?? 0)
  const reuseCount = Number(metrics.reuse_count ?? 0)
  const companyConfirmed = Boolean(verification.company_confirmed)

  const score =
    (companyConfirmed ? 20 : 0) +
    evidenceCount * 5 +
    (reuseCount >= 1 ? 10 : 0) +
    (reuseCount >= 3 ? 20 : 0)

  return (
    <div className="max-w-3xl mx-auto py-16 px-6">
      <div className="border rounded-xl p-8 bg-white shadow-sm">
        <h1 className="text-2xl font-semibold mb-2">Verificación profesional</h1>
        <p className="text-sm text-gray-500 mb-6">
          Infraestructura de confianza laboral · Verijob
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="border rounded-lg p-4">
            <p className="text-xs text-gray-500">Trust score</p>
            <p className="text-xl font-semibold">{score}</p>
          </div>

          <div className="border rounded-lg p-4">
            <p className="text-xs text-gray-500">Evidencias</p>
            <p className="text-xl font-semibold">{evidenceCount}</p>
          </div>

          <div className="border rounded-lg p-4">
            <p className="text-xs text-gray-500">Empresas reuse</p>
            <p className="text-xl font-semibold">{reuseCount}</p>
          </div>
        </div>

        <div className="border-t pt-6">
          <p className="text-sm text-gray-500 mb-2">Estado verificación</p>
          <p className="text-lg font-medium">{labelStatus(verification.status)}</p>

          {verification.is_revoked ? (
            <div className="mt-4 text-sm text-gray-600">
              <p><span className="font-medium">Revocada:</span> {verification.revoked_at ?? "—"}</p>
              <p><span className="font-medium">Motivo:</span> {verification.revoked_reason ?? "—"}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
