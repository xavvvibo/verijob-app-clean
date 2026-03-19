"use client"

import { useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { buildVerificationPayload } from "@/lib/fix-verification-payload"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ExperienceListClient({ experiences }: any) {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleVerify = async (row: any) => {
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      alert("No autenticado")
      return
    }

    const email = row.company_email

    const payload = buildVerificationPayload(
      {
        ...row,
        company_email: email
      },
      user.id // 🔴 FIX CLAVE
    )

    console.log("PAYLOAD_CLEAN", payload)

    setLoadingId(row.id)

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
        alert(data.error || "Error")
        return
      }

      window.location.reload()
    } catch {
      alert("Error red")
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div>
      {experiences.map((row: any) => (
        <div key={row.id}>
          <p>{row.position}</p>

          <button
            onClick={() => handleVerify(row)}
            disabled={loadingId === row.id}
          >
            Solicitar verificación
          </button>
        </div>
      ))}
    </div>
  )
}
