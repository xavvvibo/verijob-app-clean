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
  const [items, setItems] = useState<any[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    init()
  }, [])

  async function init() {
    const { data: sessionData } = await supabase.auth.getSession()
    const session = sessionData?.session

    if (!session) {
      console.log("NO SESSION")
      return
    }

    const uid = session.user.id
    setUserId(uid)

    const { data, error } = await supabase
      .from("evidences")
      .select("*")
      .eq("uploaded_by", uid)
      .order("created_at", { ascending: false })

    if (!error && data) {
      setItems(data)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Evidencias</h2>

      <div>User: {userId || "no session"}</div>

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
