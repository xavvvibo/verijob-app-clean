"use client"

import { useMemo, useState } from "react"
import { buildVerificationPayload } from "@/lib/fix-verification-payload"
import { createClient } from "@/utils/supabase/client"

export default function NewVerificationClient({ experiences = [] }: any) {
  const supabase = useMemo(() => createClient(), [])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [experienceId, setExperienceId] = useState(String(experiences[0]?.id ?? ""))
  const [email, setEmail] = useState("")

  const handleSubmit = async () => {
    setError("")

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      setError("No autenticado")
      return
    }

    const experience = experiences.find((row: any) => String(row?.id) === experienceId)

    if (!experience) {
      setError("Selecciona una experiencia")
      return
    }

    const payload = buildVerificationPayload(experience, user.id, email)

    console.log("PAYLOAD_FINAL_NEW_VERIFICATION", payload)

    if (!payload?.employment_record_id || !payload?.email || !payload?.requested_by) {
      setError("Payload incompleto")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/candidate/verification/create", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      console.log("VERIFICATION_RESPONSE_NEW_VERIFICATION", data)

      if (!res.ok) {
        setError(data?.details || data?.error || "Error")
        return
      }

      window.location.reload()
    } catch {
      setError("Error red")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4">
      <div>
        <label className="mb-1 block text-sm font-semibold text-gray-900">Experiencia</label>
        <select
          value={experienceId}
          onChange={(e) => setExperienceId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Selecciona una experiencia</option>
          {experiences.map((experience: any) => (
            <option key={experience.id} value={experience.id}>
              {[experience.role_title, experience.company_name].filter(Boolean).join(" - ")}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold text-gray-900">Email corporativo</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="rrhh@empresa.com"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || experiences.length === 0}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400"
      >
        {loading ? "Enviando..." : "Solicitar verificación"}
      </button>

      {experiences.length === 0 ? (
        <p className="text-sm text-gray-600">
          Primero crea una experiencia en tu perfil para poder solicitar una verificación.
        </p>
      ) : null}

      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  )
}
