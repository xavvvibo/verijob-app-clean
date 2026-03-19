"use client"

import { useState } from "react"
import { buildVerificationPayload } from "@/lib/fix-verification-payload"

export default function NewVerificationClient({ experience }: any) {
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const canVerify = !!experience?.id

  const handleSubmit = async () => {
    setError("")

    if (!experience?.id) {
      setError("Guarda la experiencia antes de verificar")
      return
    }

    const email = experience.company_email

    if (!email || !email.includes("@")) {
      setError("Email empresa no válido")
      return
    }

    setLoading(true)

    try {
      const payload = buildVerificationPayload({
        ...experience,
        company_email: email
      })

      console.log("PAYLOAD_CLEAN", payload)

      const res = await fetch("/api/candidate/verification/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      console.log("RESPONSE_DEBUG", data)

      if (!res.ok) {
        setError(data.error || "Error creando verificación")
        return
      }

      window.location.reload()
    } catch (e) {
      setError("Error de red")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleSubmit}
        disabled={!canVerify || loading}
        className={`px-4 py-2 text-white ${
          !canVerify ? "bg-gray-400" : "bg-blue-600"
        }`}
      >
        Solicitar verificación
      </button>

      {error && <p className="text-red-500">{error}</p>}
    </div>
  )
}
