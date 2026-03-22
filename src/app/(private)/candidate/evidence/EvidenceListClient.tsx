"use client"

import { useEffect, useMemo, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import {
  getEvidenceTrustImpact,
  getEvidenceTypeLabel,
  toEvidenceUiStatusWithReason,
} from "@/lib/candidate/evidence-types"

type Props = {
  initialItems: any[]
  experienceOptions: any[]
  preselectedExperienceId?: string
}

export default function EvidenceListClient({ initialItems }: Props) {
  const [items, setItems] = useState<any[]>(initialItems || [])

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  )

  function formatDates(start?: string, end?: string, isCurrent?: boolean) {
    if (!start) return ""
    const s = new Date(start).getFullYear()
    const e = isCurrent ? "Actualidad" : end ? new Date(end).getFullYear() : "Actualidad"
    return `${s} — ${e}`
  }

  useEffect(() => {
    let alive = true

    ;(async () => {
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData?.user?.id
      if (!uid) return

      const { data, error } = await supabase
        .from("evidences")
        .select(`
          id,
          evidence_type,
          document_type,
          document_scope,
          validation_status,
          inconsistency_reason,
          trust_weight,
          created_at,
          verification_requests (
            status,
            request_context,
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

      if (!alive || error || !data) return

      setItems(
        (data || []).map((row: any) => {
          const vr = Array.isArray(row.verification_requests) ? row.verification_requests[0] : row.verification_requests
          const exp = Array.isArray(vr?.employment_records) ? vr.employment_records[0] : vr?.employment_records
          const processing = vr?.request_context?.documentary_processing || {}
          const scope = String(row?.document_scope || "").toLowerCase()
          const impact = getEvidenceTrustImpact(row?.document_type || row?.evidence_type)
          const ui = toEvidenceUiStatusWithReason({
            validationStatus: row?.validation_status || vr?.status,
            inconsistencyReason: row?.inconsistency_reason || processing?.inconsistency_reason,
            matchingReason: processing?.matching_reason,
            error: processing?.error,
          })

          return {
            id: row.id,
            document_name: getEvidenceTypeLabel(row?.document_type || row?.evidence_type),
            evidence_type: row?.document_type || row?.evidence_type,
            experience:
              scope === "global"
                ? "Varias experiencias"
                : [exp?.position, exp?.company_name_freeform].filter(Boolean).join(" — ") || "Experiencia no vinculada",
            dates: formatDates(exp?.start_date, exp?.end_date, exp?.is_current),
            status: ui.status,
            reason: ui.reason || null,
            scope_label: scope === "global" ? "Evidencia global" : "Evidencia asociada a una experiencia",
            processing_label:
              String(processing?.status || "").toLowerCase() === "queued"
                ? "Archivo recibido. Pendiente de análisis."
                : String(processing?.status || "").toLowerCase() === "processing"
                  ? "Documento en análisis."
                  : String(processing?.status || "").toLowerCase() === "processed"
                    ? "Documento procesado."
                    : "Documento registrado.",
            trust_label:
              impact === "alta"
                ? "Impacto en Trust Score: alto"
                : impact === "media"
                  ? "Impacto en Trust Score: medio"
                  : impact === "baja-media"
                    ? "Impacto en Trust Score: bajo-medio"
                    : "Impacto en Trust Score: bajo",
            trust_impact: impact,
          }
        })
      )
    })()

    return () => {
      alive = false
    }
  }, [supabase])

  return (
    <div style={{ padding: 20 }}>
      <div
        style={{
          marginBottom: 18,
          borderRadius: 16,
          border: "1px solid #dbe4f0",
          background: "linear-gradient(135deg, #f8fbff 0%, #eef6ff 100%)",
          padding: 16,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20 }}>Evidencias</h2>
        <p style={{ margin: "8px 0 0", color: "#475569" }}>
          Tus evidencias documentales pueden reforzar la credibilidad de tu perfil y ayudar a sostener tu Trust Score.
        </p>
      </div>

      {items.length === 0 && <p>No hay evidencias</p>}

      {items.map((e) => {
        const impact =
          e.trust_impact ||
          getEvidenceTrustImpact(e.evidence_type || e.document_type || e.document_name)
        const impactLabel =
          impact === "alta"
            ? "Aporta confianza alta"
            : impact === "media"
              ? "Aporta confianza media"
              : impact === "baja-media"
                ? "Aporta confianza baja-media"
                : "Aporta confianza baja"

        return (
          <div
            key={e.id}
            style={{
              marginBottom: 16,
              border: "1px solid #e2e8f0",
              borderRadius: 16,
              padding: 16,
              background: "#fff",
              boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              <span style={{ fontWeight: 700, color: "#0f172a" }}>
                {e.document_name || getEvidenceTypeLabel(e.evidence_type)}
              </span>
              <span
                style={{
                  borderRadius: 999,
                  background:
                    impact === "alta"
                      ? "#dcfce7"
                      : impact === "media"
                        ? "#e0f2fe"
                        : impact === "baja-media"
                          ? "#fef3c7"
                          : "#f1f5f9",
                  color:
                    impact === "alta"
                      ? "#166534"
                      : impact === "media"
                        ? "#075985"
                        : impact === "baja-media"
                          ? "#92400e"
                          : "#475569",
                  padding: "4px 10px",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {impactLabel}
              </span>
              {e.scope_label ? (
                <span
                  style={{
                    borderRadius: 999,
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    padding: "4px 10px",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {e.scope_label}
                </span>
              ) : null}
            </div>

            <div style={{ color: "#334155", marginBottom: 6 }}>
              {e.experience || "Experiencia no vinculada"}
            </div>

            {e.dates ? (
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                {e.dates}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                {e.experience === "Varias experiencias" ? "Documento reutilizable para varias experiencias" : "Pendiente de asociación visible"}
              </div>
            )}

            {e.processing_label ? (
              <div style={{ fontSize: 13, color: "#0f172a", marginBottom: 4 }}>{e.processing_label}</div>
            ) : null}
            {e.trust_label ? (
              <div style={{ fontSize: 13, color: "#0369a1", marginBottom: 4 }}>{e.trust_label}</div>
            ) : null}
            {e.status ? (
              <div style={{ fontSize: 12, color: "#475569" }}>
                {e.status}{e.reason ? ` · ${e.reason}` : ""}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
