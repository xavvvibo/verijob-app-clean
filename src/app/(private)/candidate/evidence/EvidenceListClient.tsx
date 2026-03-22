"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"

type Props = {
  initialItems: any[]
  experienceOptions: any[]
  preselectedExperienceId?: string
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function EvidenceListClient({ initialItems }: Props) {
  const [items, setItems] = useState<any[]>(initialItems || [])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data, error } = await supabase
      .from("evidences")
      .select("*")
      .order("created_at", { ascending: false })

    if (!error && data) {
      setItems(data)
    }
  }

  async function fakeUpload() {
    alert("Subida real desactivada en debug.\nAhora solo necesitamos validar backend.")
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Evidencias</h2>

      <button onClick={fakeUpload} style={{ marginBottom: 20 }}>
        Subir evidencia (debug)
      </button>

      {items.length === 0 && <p>No hay evidencias</p>}

      {items.map((e) => (
        <div key={e.id} style={{ marginBottom: 10 }}>
          <strong>{e.evidence_type}</strong>
          <div>{e.uploaded_by}</div>
        </div>
      ))}
    </div>
  )
}
