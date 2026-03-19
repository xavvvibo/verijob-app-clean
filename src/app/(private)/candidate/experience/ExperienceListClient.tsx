"use client"

import { useMemo, useState } from "react"
import { buildVerificationPayload } from "@/lib/fix-verification-payload"
import { createClient } from "@/utils/supabase/client"

export default function ExperienceListClient(props: any) {
  const supabase = useMemo(() => createClient(), [])
  const experiences = props?.initialRows ?? props?.experiences ?? []
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [emailById, setEmailById] = useState<Record<string, string>>({})

  const handleVerify = async (row: any) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      alert("No autenticado")
      return
    }

    const rowId = String(row?.id ?? "")
    const email = String(emailById[rowId] ?? row?.company_email ?? "").trim()

    if (!rowId) {
      alert("Falta la experiencia")
      return
    }

    if (!email || !email.includes("@")) {
      alert("Introduce un email corporativo valido")
      return
    }

    const payload = buildVerificationPayload(row, user.id, email)

    console.log("PAYLOAD_FINAL_EXPERIENCE_LIST", payload)

    setLoadingId(rowId)

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
        <div key={row.id} className="mb-4 rounded-2xl border border-gray-200 p-4">
          <p className="font-semibold text-gray-900">{row.role_title || row.position || "Experiencia"}</p>
          <p className="text-sm text-gray-600">{row.company_name || "Empresa no indicada"}</p>
          <div className="mt-3 space-y-2">
            <input
              type="email"
              value={emailById[String(row.id)] ?? ""}
              onChange={(e) =>
                setEmailById((current) => ({
                  ...current,
                  [String(row.id)]: e.target.value,
                }))
              }
              placeholder="Email corporativo de la empresa"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500">
              Enviaremos la solicitud a un email corporativo para verificar esta experiencia concreta.
            </p>
          </div>
          <button
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400"
            onClick={() => handleVerify(row)}
            disabled={loadingId === String(row.id)}
          >
            {loadingId === String(row.id) ? "Enviando..." : "Solicitar verificación"}
          </button>
        </div>
      ))}
    </div>
  )
}
