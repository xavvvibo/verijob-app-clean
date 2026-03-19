"use client"

import { useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { buildVerificationPayload } from "@/lib/fix-verification-payload"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ExperienceListClient(props: any) {
  const experiences = props?.experiences ?? []
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleVerify = async (row: any) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      alert("No autenticado")
      return
    }

    const email = String(row?.company_email ?? "").trim()

    if (!row?.id || !email) {
      alert("Faltan datos de la experiencia")
      return
    }

    const payload = buildVerificationPayload(
      {
        ...row,
        company_email: email,
      },
      user.id
    )

    console.log("PAYLOAD_FINAL_EXPERIENCE_LIST", payload)

    setLoadingId(String(row.id))

    try {
      const res = await fetch("/api/candidate/verification/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      console.log("VERIFICATION_RESPONSE_EXPERIENCE_LIST", data)

      if (!res.ok) {
        alert(data?.error || "Error")
        return
      }

      window.location.reload()
    } catch {
      alert("Error de red")
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
            disabled={loadingId === String(row.id)}
          >
            Solicitar verificación
          </button>
        </div>
      ))}
    </div>
  )
}
