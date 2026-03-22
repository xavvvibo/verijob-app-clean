"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import {
  getEvidenceTypeOptions,
  requiresExperienceAssociation,
} from "@/lib/candidate/evidence-types"
import { buildEvidenceUiItem } from "@/lib/candidate/evidence-ui"

type Props = {
  initialItems: any[]
  experienceOptions: any[]
  preselectedExperienceId?: string
}

async function sha256Hex(file: File) {
  const buffer = await file.arrayBuffer()
  const hash = await crypto.subtle.digest("SHA-256", buffer)
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

async function readJsonSafe(response: Response) {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { error: text, details: text }
  }
}

export default function EvidenceListClient({
  initialItems,
  experienceOptions,
  preselectedExperienceId,
}: Props) {
  const [items, setItems] = useState<any[]>(initialItems || [])
  const [selectedExperienceId, setSelectedExperienceId] = useState(preselectedExperienceId || "")
  const [selectedEvidenceType, setSelectedEvidenceType] = useState(
    preselectedExperienceId ? "contrato_trabajo" : "vida_laboral"
  )
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [reconciliationDrafts, setReconciliationDrafts] = useState<Record<string, Record<string, string>>>({})
  const [savingReconciliationId, setSavingReconciliationId] = useState<string | null>(null)
  const [reconciliationFeedback, setReconciliationFeedback] = useState<Record<string, any>>({})

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  )

  const reloadList = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData?.user?.id
    if (!uid) return

    const { data, error } = await supabase
      .from("evidences")
      .select(`
        id,
        verification_request_id,
        created_at,
        evidence_type,
        document_type,
        document_scope,
        validation_status,
        inconsistency_reason,
        trust_weight,
        verification_requests (
          id,
          status,
          request_context,
          employment_record_id,
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
      setItems((data || []).map((row: any) => buildEvidenceUiItem(row)))
    }
  }, [supabase])

  useEffect(() => {
    void reloadList()
  }, [reloadList])

  const evidenceTypeOptions = useMemo(() => getEvidenceTypeOptions(), [])
  const requiresExperience = requiresExperienceAssociation(selectedEvidenceType)
  const selectedExperienceLabel = useMemo(
    () => experienceOptions.find((item: any) => item.id === selectedExperienceId)?.label || null,
    [experienceOptions, selectedExperienceId]
  )

  const focusedItems = useMemo(() => {
    if (!selectedExperienceId) return items
    return items.filter((item) => String(item?.employment_record_id || "") === String(selectedExperienceId))
  }, [items, selectedExperienceId])

  const otherItems = useMemo(() => {
    if (!selectedExperienceId) return []
    return items.filter((item) => String(item?.employment_record_id || "") !== String(selectedExperienceId))
  }, [items, selectedExperienceId])

  async function prepareEvidenceUpload(payload: Record<string, any>) {
    const routes = ["/api/candidate/evidence/upload", "/api/candidate/evidence/upload-url"]

    for (const route of routes) {
      const res = await fetch(route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
      const json = await readJsonSafe(res)
      if (res.ok && json?.signed_url && json?.storage_path && json?.verification_request_id) {
        return json
      }
      if (route === routes[routes.length - 1]) {
        throw new Error(
          String(json?.details || json?.error || "No se pudo preparar la subida de la evidencia.")
        )
      }
    }

    throw new Error("No se pudo preparar la subida de la evidencia.")
  }

  async function uploadEvidence() {
    if (!selectedFile) {
      setIsError(true)
      setMessage("Selecciona un documento antes de continuar.")
      return
    }
    if (requiresExperience && !selectedExperienceId) {
      setIsError(true)
      setMessage("Selecciona la experiencia objetivo para este documento.")
      return
    }

    setBusy(true)
    setIsError(false)
    setMessage("Preparando la subida del documento…")

    try {
      const fileSha256 = await sha256Hex(selectedFile)
      const prepare = await prepareEvidenceUpload({
        employment_record_id: selectedExperienceId || null,
        evidence_type: selectedEvidenceType,
        mime: selectedFile.type,
        size_bytes: selectedFile.size,
        filename: selectedFile.name,
        file_sha256: fileSha256,
      })

      const signedPut = await fetch(String(prepare.signed_url), {
        method: "PUT",
        headers: { "Content-Type": selectedFile.type || "application/octet-stream" },
        body: selectedFile,
      })

      if (!signedPut.ok) {
        const putText = await signedPut.text().catch(() => "")
        throw new Error(putText || "No se pudo subir el archivo al almacenamiento.")
      }

      const confirmRes = await fetch("/api/candidate/evidence/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          verification_request_id: prepare.verification_request_id,
          storage_path: prepare.storage_path,
          storage_bucket: prepare.storage_bucket || "evidence",
          original_filename: prepare.original_filename || selectedFile.name,
          mime: prepare.mime || selectedFile.type,
          size_bytes: prepare.size_bytes || selectedFile.size,
          evidence_type: selectedEvidenceType,
          file_sha256: fileSha256,
        }),
      })

      const confirmJson = await readJsonSafe(confirmRes)
      if (!confirmRes.ok) {
        throw new Error(
          String(confirmJson?.details || confirmJson?.error || "No se pudo registrar la evidencia.")
        )
      }

      if (String(selectedExperienceId || "").startsWith("profile:") && prepare?.employment_record_id) {
        setSelectedExperienceId(String(prepare.employment_record_id))
      }

      setSelectedFile(null)
      setMessage("Documento registrado. Iniciaremos el análisis automático en segundo plano.")
      await reloadList()
    } catch (error: any) {
      setIsError(true)
      setMessage(String(error?.message || error || "No se pudo registrar la evidencia."))
    } finally {
      setBusy(false)
    }
  }

  async function deleteEvidence(id: string) {
    if (!id) {
      console.error("EVIDENCE_DELETE_MISSING_ID", { id })
      setIsError(true)
      setMessage("No se pudo identificar el documento que intentas eliminar.")
      return
    }

    setDeletingId(id)
    setIsError(false)
    setMessage(null)
    try {
      const res = await fetch(`/api/candidate/evidence/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      })
      const json = await readJsonSafe(res)
      if (!res.ok) {
        throw new Error(String(json?.details || json?.error || "No se pudo eliminar la evidencia."))
      }
      setItems((prev) => prev.filter((item) => item.id !== id))
      await reloadList()
    } catch (error: any) {
      setIsError(true)
      setMessage(String(error?.message || error || "No se pudo eliminar la evidencia."))
    } finally {
      setDeletingId(null)
    }
  }

  function formatPeriod(start?: string | null, end?: string | null) {
    const startText = String(start || "").slice(0, 10)
    const endText = String(end || "").slice(0, 10)
    if (!startText && !endText) return "Fechas no detectadas"
    return `${startText || "—"} · ${endText || "Actualidad"}`
  }

  function getEntrySelection(item: any, entry: any) {
    const evidenceDraft = reconciliationDrafts[String(item.evidence_id || "")]
    if (evidenceDraft && Object.prototype.hasOwnProperty.call(evidenceDraft, String(entry.entry_id || ""))) {
      return evidenceDraft[String(entry.entry_id || "")]
    }
    if (entry.linked_employment_record_id) return String(entry.linked_employment_record_id)
    if (entry.reconciliation_choice === "ignore" || entry.reconciliation_status === "ignored") return "__ignore__"
    if (entry.reconciliation_choice === "create_new") return "__create_new__"
    if (entry.suggested_match_employment_record_id) return String(entry.suggested_match_employment_record_id)
    return ""
  }

  function setEntrySelection(evidenceId: string, entryId: string, value: string) {
    setReconciliationDrafts((prev) => ({
      ...prev,
      [evidenceId]: {
        ...(prev[evidenceId] || {}),
        [entryId]: value,
      },
    }))
  }

  async function saveVidaLaboralReconciliation(item: any) {
    const evidenceId = String(item.evidence_id || "")
    const entries = Array.isArray(item.extracted_employment_entries) ? item.extracted_employment_entries : []
    if (!evidenceId || entries.length === 0) return

    setSavingReconciliationId(evidenceId)
    setIsError(false)
    setMessage("Guardando conciliación de experiencias…")
    try {
      const res = await fetch(`/api/candidate/evidence/${encodeURIComponent(evidenceId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "reconcile_vida_laboral",
          entries: entries
            .filter((entry: any) => !entry?.ignored_reason)
            .map((entry: any) => ({
              entry_id: entry.entry_id,
              selection: getEntrySelection(item, entry) || "__ignore__",
            })),
        }),
      })
      const json = await readJsonSafe(res)
      if (!res.ok) {
        throw new Error(String(json?.details || json?.error || "No se pudo guardar la conciliación."))
      }
      const summary = json?.reconciliation_summary || null
      setReconciliationFeedback((prev) => ({
        ...prev,
        [evidenceId]: summary,
      }))
      setMessage(
        String(
          summary?.message ||
            "Conciliación guardada. Hemos actualizado las experiencias vinculadas por esta fe de vida laboral.",
        ),
      )
      setReconciliationDrafts((prev) => {
        const next = { ...prev }
        delete next[evidenceId]
        return next
      })
      await reloadList()
    } catch (error: any) {
      setIsError(true)
      setMessage(String(error?.message || error || "No se pudo guardar la conciliación."))
    } finally {
      setSavingReconciliationId(null)
    }
  }

  function renderVidaLaboralReconciliation(item: any) {
    const entries = Array.isArray(item.extracted_employment_entries) ? item.extracted_employment_entries : []
    if (!item.analysis_completed || item.evidence_type_key !== "vida_laboral" || entries.length === 0) return null
    const summary = reconciliationFeedback[String(item.evidence_id || "")] || item.reconciliation_summary || null

    return (
      <div
        style={{
          marginTop: 12,
          borderRadius: 14,
          border: "1px solid #dbe4f0",
          background: "#f8fbff",
          padding: 14,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
          Fe de vida laboral procesada
        </div>
        {item.identity_status_label ? (
          <div style={{ fontSize: 12, color: item.match_level === "conflict" ? "#b91c1c" : "#0f766e", marginBottom: 10 }}>
            {item.identity_status_label}
          </div>
        ) : null}
        <div style={{ fontSize: 12, color: "#475569", marginBottom: 12 }}>
          Revisa las experiencias detectadas y decide si corresponden a una experiencia ya declarada, si debes crear una nueva o si no deben vincularse.
        </div>
        {summary ? (
          <div
            style={{
              marginBottom: 12,
              borderRadius: 12,
              border: "1px solid #bfdbfe",
              background: "#eff6ff",
              padding: 12,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1d4ed8", marginBottom: 4 }}>
              Resultado de la conciliación guardada
            </div>
            <div style={{ fontSize: 12, color: "#1e3a8a", marginBottom: 8 }}>
              {String(summary?.message || "").trim() || "Conciliación guardada."}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: summary?.material_changes ? 10 : 0 }}>
              <span style={{ borderRadius: 999, background: "#dbeafe", color: "#1d4ed8", padding: "4px 10px", fontSize: 12, fontWeight: 600 }}>
                {Number(summary?.linked_existing_count || 0)} vinculadas
              </span>
              <span style={{ borderRadius: 999, background: "#dcfce7", color: "#166534", padding: "4px 10px", fontSize: 12, fontWeight: 600 }}>
                {Number(summary?.created_count || 0)} creadas
              </span>
              <span style={{ borderRadius: 999, background: "#fef3c7", color: "#92400e", padding: "4px 10px", fontSize: 12, fontWeight: 600 }}>
                {Number(summary?.ignored_count || 0) + Number(summary?.auto_ignored_count || 0)} ignoradas
              </span>
            </div>
            {summary?.material_changes ? (
              <div>
                <a
                  href="/candidate/experience"
                  style={{
                    display: "inline-flex",
                    borderRadius: 10,
                    background: "#1d4ed8",
                    color: "#fff",
                    padding: "8px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Ver experiencias actualizadas
                </a>
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 10 }}>
          {entries.map((entry: any) => {
            const ignored = Boolean(entry.ignored_reason)
            const linked = String(entry.linked_employment_record_id || "").trim()
            const selection = getEntrySelection(item, entry)
            return (
              <div
                key={entry.entry_id}
                style={{
                  borderRadius: 12,
                  border: "1px solid #dbe4f0",
                  background: "#fff",
                  padding: 12,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{entry.company_name}</div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{formatPeriod(entry.start_date, entry.end_date)}</div>
                {entry.raw_text ? (
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>{entry.raw_text}</div>
                ) : null}
                {ignored ? (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#92400e" }}>
                    Movimiento omitido automáticamente: no corresponde a una experiencia laboral válida del CV.
                  </div>
                ) : null}
                {!ignored ? (
                  <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>
                        ¿A qué experiencia declarada corresponde?
                      </span>
                      <select
                        value={selection}
                        onChange={(event) =>
                          setEntrySelection(String(item.evidence_id || ""), String(entry.entry_id || ""), event.target.value)
                        }
                        style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: "10px 12px", fontSize: 14 }}
                      >
                        <option value="">Selecciona una experiencia</option>
                        {experienceOptions.map((option: any) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                        <option value="__create_new__">Añadir nueva experiencia con estos datos</option>
                        <option value="__ignore__">No vincular</option>
                      </select>
                    </label>
                    {entry.suggested_match_employment_record_id ? (
                      <div style={{ fontSize: 12, color: "#0369a1" }}>
                        Sugerencia automática detectada para ayudarte a reconciliar esta línea.
                      </div>
                    ) : null}
                    {linked ? (
                      <div style={{ fontSize: 12, color: "#166534" }}>
                        Esta línea ya quedó conciliada con una experiencia del perfil.
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => void saveVidaLaboralReconciliation(item)}
            disabled={savingReconciliationId === String(item.evidence_id || "")}
            style={{
              borderRadius: 10,
              background: "#0f766e",
              color: "#fff",
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 700,
              border: "none",
              cursor: savingReconciliationId === String(item.evidence_id || "") ? "not-allowed" : "pointer",
              opacity: savingReconciliationId === String(item.evidence_id || "") ? 0.7 : 1,
            }}
          >
            {savingReconciliationId === String(item.evidence_id || "") ? "Guardando…" : "Guardar conciliación"}
          </button>
        </div>
      </div>
    )
  }

  function renderEvidenceCard(item: any) {
    const showAnalysisOutcome = Boolean(item.analysis_completed)
    const isVidaLaboral = item.evidence_type_key === "vida_laboral"
    const impactTone =
      item.trust_impact === "alta"
        ? { bg: "#dcfce7", color: "#166534" }
        : item.trust_impact === "media"
          ? { bg: "#e0f2fe", color: "#075985" }
          : item.trust_impact === "baja-media"
            ? { bg: "#fef3c7", color: "#92400e" }
            : { bg: "#f1f5f9", color: "#475569" }

    const matchTone =
      item.match_level === "high"
        ? { bg: "#dcfce7", color: "#166534" }
        : item.match_level === "medium"
          ? { bg: "#e0f2fe", color: "#075985" }
          : item.match_level === "low"
            ? { bg: "#fef3c7", color: "#92400e" }
            : item.match_level === "conflict"
              ? { bg: "#fee2e2", color: "#b91c1c" }
              : { bg: "#f8fafc", color: "#475569" }

    const impactLabel =
      item.trust_impact === "alta"
        ? "Aporta confianza alta"
        : item.trust_impact === "media"
          ? "Aporta confianza media"
          : item.trust_impact === "baja-media"
            ? "Aporta confianza baja-media"
            : "Aporta confianza baja"

    return (
      <div
        key={item.id}
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
          <span style={{ fontWeight: 700, color: "#0f172a" }}>{item.document_name}</span>
          {showAnalysisOutcome ? (
            <span style={{ borderRadius: 999, background: impactTone.bg, color: impactTone.color, padding: "4px 10px", fontSize: 12, fontWeight: 600 }}>
              {impactLabel}
            </span>
          ) : null}
          {showAnalysisOutcome && item.match_label ? (
            <span style={{ borderRadius: 999, background: matchTone.bg, color: matchTone.color, padding: "4px 10px", fontSize: 12, fontWeight: 600 }}>
              {item.match_label}
            </span>
          ) : null}
          <span style={{ borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", padding: "4px 10px", fontSize: 12, fontWeight: 600 }}>
            {item.scope_label}
          </span>
        </div>

        <div style={{ color: "#334155", marginBottom: 6 }}>{item.experience}</div>
        {item.dates ? (
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>{item.dates}</div>
        ) : null}
        <div style={{ fontSize: 13, color: "#0f172a", marginBottom: 4 }}>{item.processing_label}</div>
        {showAnalysisOutcome && item.match_summary ? (
          <div style={{ fontSize: 13, color: "#334155", marginBottom: 4 }}>{item.match_summary}</div>
        ) : null}
        {showAnalysisOutcome && item.supporting_experiences_label ? (
          <div style={{ fontSize: 12, color: "#0369a1", marginBottom: 6 }}>{item.supporting_experiences_label}</div>
        ) : null}
        {showAnalysisOutcome && !isVidaLaboral ? (
          <div style={{ display: "grid", gap: 4, marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: item.match_level === "conflict" ? "#b91c1c" : "#334155" }}>
              {item.person_check_label}
            </div>
            <div style={{ fontSize: 12, color: "#475569" }}>{item.company_check_label}</div>
            <div style={{ fontSize: 12, color: "#475569" }}>{item.date_check_label}</div>
            <div style={{ fontSize: 12, color: "#475569" }}>{item.position_check_label}</div>
          </div>
        ) : null}
        {showAnalysisOutcome && item.trust_label ? (
          <div style={{ fontSize: 13, color: "#0369a1", marginBottom: 4 }}>{item.trust_label}</div>
        ) : null}
        {renderVidaLaboralReconciliation(item)}
        <div style={{ fontSize: 12, color: "#475569" }}>
          {item.status}{item.reason ? ` · ${item.reason}` : ""}
        </div>

        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => void deleteEvidence(String(item.evidence_id || ""))}
            disabled={deletingId === String(item.evidence_id || "")}
            style={{
              borderRadius: 10,
              border: "1px solid #fecaca",
              background: "#fff",
              color: "#b91c1c",
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 600,
              cursor: deletingId === String(item.evidence_id || "") ? "not-allowed" : "pointer",
              opacity: deletingId === String(item.evidence_id || "") ? 0.6 : 1,
            }}
          >
            {deletingId === String(item.evidence_id || "") ? "Eliminando…" : "Eliminar documento"}
          </button>
        </div>
      </div>
    )
  }

  const visibleItems = selectedExperienceId ? focusedItems : items

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
        <h2 style={{ margin: 0, fontSize: 20 }}>
          {selectedExperienceLabel ? "Documentación vinculada a esta experiencia" : "Evidencias"}
        </h2>
        <p style={{ margin: "8px 0 0", color: "#475569" }}>
          Tus documentos pueden reforzar la credibilidad del perfil. Cada evidencia muestra su estado de análisis, su coincidencia con la experiencia y su aporte cualitativo a confianza.
        </p>
        {selectedExperienceLabel ? (
          <div style={{ marginTop: 10, fontSize: 13, color: "#0f172a", fontWeight: 600 }}>
            Experiencia activa: {selectedExperienceLabel}
          </div>
        ) : null}
      </div>

      <div
        style={{
          marginBottom: 20,
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          padding: 16,
          background: "#fff",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>
          Subir nueva documentación
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Tipo documental</span>
            <select
              value={selectedEvidenceType}
              onChange={(event) => setSelectedEvidenceType(event.target.value)}
              style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: "10px 12px", fontSize: 14 }}
            >
              {evidenceTypeOptions.map((option: any) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Experiencia objetivo</span>
            <select
              value={selectedExperienceId}
              onChange={(event) => setSelectedExperienceId(event.target.value)}
              disabled={!experienceOptions.length}
              style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: "10px 12px", fontSize: 14, opacity: !experienceOptions.length ? 0.6 : 1 }}
            >
              <option value="">
                {requiresExperience ? "Selecciona una experiencia" : "Sin experiencia concreta (documento global)"}
              </option>
              {experienceOptions.map((option: any) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Archivo</span>
            <input
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: "10px 12px", fontSize: 14 }}
            />
          </label>

          {message ? (
            <div
              style={{
                borderRadius: 12,
                padding: "10px 12px",
                background: isError ? "#fef2f2" : "#eff6ff",
                color: isError ? "#b91c1c" : "#1d4ed8",
                fontSize: 13,
              }}
            >
              {message}
            </div>
          ) : null}

          <div>
            <button
              type="button"
              onClick={() => void uploadEvidence()}
              disabled={busy}
              style={{
                borderRadius: 10,
                background: "#1d4ed8",
                color: "#fff",
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: 700,
                border: "none",
                cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? "Subiendo documento…" : "Subir documentación"}
            </button>
          </div>
        </div>
      </div>

      {visibleItems.length === 0 ? <p>No hay evidencias registradas todavía.</p> : null}
      {visibleItems.map((item) => renderEvidenceCard(item))}

      {selectedExperienceId && otherItems.length > 0 ? (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#334155", marginBottom: 12 }}>
            Otras evidencias del perfil
          </div>
          {otherItems.map((item) => renderEvidenceCard(item))}
        </div>
      ) : null}
    </div>
  )
}
