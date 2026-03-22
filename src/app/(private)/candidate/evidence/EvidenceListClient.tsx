"use client"

import { useEffect, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"

type Props = {
  initialItems: any[]
  experienceOptions: any[]
  preselectedExperienceId?: string
}

export default function EvidenceListClient({ initialItems }: Props) {
  const [items, setItems] = useState<any[]>(initialItems || [])

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData?.user?.id
    if (!uid) return

    const { data, error } = await supabase
      .from("evidences")
      .select(`
        id,
        evidence_type,
        verification_requests (
          employment_records (
            id,
            company_name_freeform,
            position,
            start_date,
            end_date,
            is_current
          )
        )
      `)
      .eq("uploaded_by", uid)
      .order("created_at", { ascending: false })

    if (!error && data) {
      setItems(data)
    }
  }

  function formatDates(start?: string, end?: string, isCurrent?: boolean) {
    if (!start) return ""
    const s = new Date(start).getFullYear()
    const e = isCurrent ? "Actualidad" : end ? new Date(end).getFullYear() : "Actualidad"
    return `${s} — ${e}`
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Evidencias</h2>

      {items.length === 0 && <p>No hay evidencias</p>}

      {items.map((e) => {
        const exp = e.verification_requests?.employment_records

        return (
          <div key={e.id} style={{ marginBottom: 16 }}>
            <div><strong>{e.evidence_type}</strong></div>

            {exp ? (
              <div style={{ color: "#666" }}>
                {exp.position || "Puesto no definido"} —{" "}
                {exp.company_name_freeform || "Empresa no definida"}
                <div style={{ fontSize: 12 }}>
                  {formatDates(exp.start_date, exp.end_date, exp.is_current)}
                </div>
              </div>
            ) : (
              <div style={{ color: "red" }}>
                No vinculada a experiencia
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
