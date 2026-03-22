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
          employment_record_id
        )
      `)
      .eq("uploaded_by", uid)
      .order("created_at", { ascending: false })

    if (!error && data) {
      setItems(data)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Evidencias</h2>

      {items.length === 0 && <p>No hay evidencias</p>}

      {items.map((e) => (
        <div key={e.id} style={{ marginBottom: 10 }}>
          <strong>{e.evidence_type}</strong>
          <div>
            Experiencia:{" "}
            {e.verification_requests?.employment_record_id || "no vinculada"}
          </div>
        </div>
      ))}
    </div>
  )
}
