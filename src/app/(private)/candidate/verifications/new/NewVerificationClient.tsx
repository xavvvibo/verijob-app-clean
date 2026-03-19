"use client"

import { useState } from "react"

export default function NewVerificationClient({ experience }: any) {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError("")

    if (!experience?.id) {
      setError("Debes guardar la experiencia antes de solicitar verificación")
      return
    }

    if (!email) {
      setError("Introduce un email")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/candidate/verification/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          employment_record_id: experience.id,
          email
        })
      })

      const data = await res.json()

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
    <div>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email verificador"
      />

      <button onClick={handleSubmit} disabled={loading}>
        Solicitar verificación
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  )
}
