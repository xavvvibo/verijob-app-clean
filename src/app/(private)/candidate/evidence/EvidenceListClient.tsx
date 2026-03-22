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
  const [debug, setDebug] = useState<any>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id

    const { data, error } = await supabase
      .from("evidences")
      .select("*")
      .order("created_at", { ascending: false })

    setDebug({
      userId,
      count: data?.length,
      error,
      sample: data?.[0] || null,
    })

    if (!error && data) {
      setItems(data)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>DEBUG EVIDENCIAS</h2>

      <pre>{JSON.stringify(debug, null, 2)}</pre>

      <hr />

      {items.length === 0 && <p>No hay evidencias</p>}

      {items.map((e) => (
        <div key={e.id}>
          <strong>{e.evidence_type}</strong>
          <div>{e.uploaded_by}</div>
        </div>
      ))}
    </div>
  )
}
