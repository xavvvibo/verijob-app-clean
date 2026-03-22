"use client"

type Props = {
  initialItems: any[]
  experienceOptions: any[]
  preselectedExperienceId?: string
}

export default function EvidenceListClient({ initialItems }: Props) {
  return (
    <div style={{ padding: 20 }}>
      <h2>Listado de evidencias</h2>

      {initialItems?.length === 0 && <p>No hay evidencias</p>}

      {initialItems?.map((e: any) => (
        <div key={e.id} style={{ marginBottom: 10 }}>
          <strong>{e.evidence_type}</strong>
          <div>{e.storage_path}</div>
        </div>
      ))}
    </div>
  )
}
