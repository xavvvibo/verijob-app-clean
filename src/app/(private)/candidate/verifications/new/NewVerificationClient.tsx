"use client"

import { useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { buildVerificationPayload } from "@/lib/fix-verification-payload"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function NewVerificationClient({ experience }: any) {
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError("")

    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      setError("No autenticado")
      return
    }

    const payload = buildVerificationPayload(experience, user.id)

    console.log("PAYLOAD_FINAL", payload)

    setLoading(true)

    try {
      const res = await fetch("/api/candidate/verification/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Error")
        return
      }

      window.location.reload()
    } catch (e) {
      setError("Error red")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button onClick={handleSubmit} disabled={loading}>
        Solicitar verificación
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  )
}
