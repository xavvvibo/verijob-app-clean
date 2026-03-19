"use client"

import { useState } from "react"

export default function NewVerificationClient({ experience }: any) {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const canVerify = !!experience?.id

  const handleSubmit = async () => {
    setError("")

    if (!experience?.id) {
      setError("Guarda la experiencia antes de verificar")
      return
    }

    if (!email || !email.includes("@")) {
      setError("Email no válido")
      return
    }

    setLoading(true)

    try {
      const payload = {
        employment_record_id: experience.id,
        email: email.trim()
      }

      console.log("PAYLOAD_DEBUG", payload)

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
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email verificador"
        className="border p-2 w-full"
      />

      <button
        onClick={handleSubmit}
        disabled={!canVerify || loading}
        className={`px-4 py-2 text-white ${
          !canVerify ? "bg-gray-400" : "bg-blue-600"
        }`}
      >
        Solicitar verificación
      </button>

      {!canVerify && (
        <p className="text-sm text-gray-500">
          Guarda la experiencia antes de solicitar verificación
        </p>
      )}

      {error && <p className="text-red-500">{error}</p>}
    </div>
  )
}
