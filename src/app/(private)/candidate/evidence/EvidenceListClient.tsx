"use client"

import { useEffect, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"

type Props = {
  initialItems: any[]
  experienceOptions: any[]
  preselectedExperienceId?: string
}

export default function EvidenceListClient({ initialItems }: Props) {
  const [items, setItems] = useState<any[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    init()
  }, [])

  async function init() {
    const { data: userData } = await supabase.auth.getUser()

    const uid = userData?.user?.id || null
    setUserId(uid)

    if (!uid) return

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
        <div key={e.id}>
          <strong>{e.evidence_type}</strong>
        </div>
      ))}
    </div>
  )
}
