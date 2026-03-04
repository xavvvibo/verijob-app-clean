type Props = {
  data: any
}

export default function VerifiedCV({ data }: Props) {

  const verification = data?.verification
  const evidences = data?.evidences || []
  const reuse = data?.reuse || []

  const evidenceCount = evidences.length
  const reuseCount = reuse.length

  const score =
    (verification?.company_confirmed ? 20 : 0) +
    evidenceCount * 5 +
    (reuseCount >= 1 ? 10 : 0) +
    (reuseCount >= 3 ? 20 : 0)

  return (
    <div className="max-w-3xl mx-auto py-16 px-6">

      <div className="border rounded-xl p-8 bg-white shadow-sm">

        <h1 className="text-2xl font-semibold mb-2">
          Verificación profesional
        </h1>

        <p className="text-sm text-gray-500 mb-6">
          Infraestructura de confianza laboral · Verijob
        </p>

        <div className="grid grid-cols-3 gap-6 mb-8">

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

          <p className="text-sm text-gray-500 mb-2">
            Estado verificación
          </p>

          <p className="text-lg font-medium">
            {verification?.status || "unknown"}
          </p>

        </div>

      </div>

    </div>
  )
}
