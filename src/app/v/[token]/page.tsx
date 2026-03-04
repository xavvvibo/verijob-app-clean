import VerifiedCV from "@/components/public/VerifiedCV"
import { headers } from "next/headers"

async function getBaseUrl() {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const proto = h.get("x-forwarded-proto") ?? "https"
  if (!host) return "https://app.verijob.es"
  return `${proto}://${host}`
}

async function getData(token: string) {
  const baseUrl = await getBaseUrl()
  const res = await fetch(`${baseUrl}/api/public/verification/${token}`, {
    cache: "no-store"
  })
  if (!res.ok) return null
  return res.json()
}

export default async function Page(
  props: { params: Promise<{ token: string }> }
) {
  const { token } = await props.params
  const data = await getData(token)

  if (!data) {
    return (
      <div className="max-w-xl mx-auto py-20 px-6 text-center">
        <h1 className="text-xl font-semibold mb-2">Verificación no encontrada</h1>
        <p className="text-gray-500">
          El enlace público no es válido o no está disponible.
        </p>
      </div>
    )
  }

  return <VerifiedCV data={data} />
}

// deploy-trigger 2026-03-04T08:16:33Z
