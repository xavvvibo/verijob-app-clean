"use client"

import Link from "next/link"
import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { buildVerificationPayload } from "@/lib/fix-verification-payload"

type Step = "intro" | "experience" | "verification" | "evidence" | "done"

type ExperienceInput = {
  id: string
  profile_experience_id: string
  employment_record_id: string
  role_title: string
  company_name: string
  start_date: string
  end_date: string
  description: string
  matched_verification_id?: string
}

type VerificationInput = {
  id: string
  status: string
  requested_at: string | null
  resolved_at: string | null
  external_email_target: string | null
  employment_record_id: string | null
}

type EvidenceInput = {
  id: string
  document_type: string
  created_at: string | null
  validation_status: string | null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeDateForSave(value: string) {
  const raw = String(value || "").trim()
  if (!raw) return null
  if (/^\d{4}-\d{2}$/.test(raw)) return `${raw}-01`
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return raw
}

function formatMonth(value: string | null | undefined) {
  const raw = String(value || "").trim()
  if (!raw) return "Sin fecha"
  const normalized = raw.slice(0, 7)
  const [year, month] = normalized.split("-")
  if (!year || !month) return raw
  const date = new Date(`${year}-${month}-01T00:00:00`)
  if (Number.isNaN(date.getTime())) return raw
  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(date)
}

function humanVerificationStatus(status: string | null | undefined) {
  const value = String(status || "").toLowerCase()
  if (value === "verified") return "Verificada"
  if (value === "rejected") return "No validada"
  if (value === "reviewing") return "En revisión"
  if (value === "pending_company" || value === "verification_requested") return "Pendiente de respuesta"
  return "Sin enviar todavía"
}

function stepTitle(step: Step) {
  if (step === "experience") return "Paso 1 de 3 · Experiencia"
  if (step === "verification") return "Paso 2 de 3 · Verificación"
  if (step === "evidence") return "Paso 3 de 3 · Refuerza tu perfil"
  return ""
}

function deriveInitialStep(args: {
  onboardingStep: string | null
  experience: ExperienceInput | null
  verification: VerificationInput | null
  evidenceCount: number
}) {
  if (args.onboardingStep === "finish") return "done" as const
  if (!args.experience) {
    return args.onboardingStep === "experience" ? "experience" : "intro"
  }
  if (!args.verification) return "verification" as const
  if (args.evidenceCount > 0) return "done" as const
  return "evidence" as const
}

export default function CandidateOnboardingFlow({
  initialProfile,
  initialExperience,
  initialVerification,
  initialEvidence,
  initialTrustScore,
}: {
  initialProfile: { fullName: string | null; onboardingStep: string | null }
  initialExperience: ExperienceInput | null
  initialVerification: VerificationInput | null
  initialEvidence: EvidenceInput[]
  initialTrustScore: number
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [step, setStep] = useState<Step>(
    deriveInitialStep({
      onboardingStep: initialProfile.onboardingStep,
      experience: initialExperience,
      verification: initialVerification,
      evidenceCount: initialEvidence.length,
    }),
  )
  const [savingExperience, setSavingExperience] = useState(false)
  const [sendingVerification, setSendingVerification] = useState(false)
  const [uploadingEvidence, setUploadingEvidence] = useState(false)
  const [completing, setCompleting] = useState(false)

  const [experienceMessage, setExperienceMessage] = useState<string | null>(null)
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null)
  const [evidenceMessage, setEvidenceMessage] = useState<string | null>(null)
  const [verificationError, setVerificationError] = useState<string | null>(null)

  const [experience, setExperience] = useState<ExperienceInput | null>(
    initialExperience || {
      id: "",
      profile_experience_id: "",
      employment_record_id: "",
      role_title: "",
      company_name: "",
      start_date: "",
      end_date: "",
      description: "",
    },
  )
  const [currentRole, setCurrentRole] = useState(!initialExperience?.end_date)
  const [verification, setVerification] = useState<VerificationInput | null>(initialVerification)
  const [verificationEmail, setVerificationEmail] = useState(initialVerification?.external_email_target || "")
  const [evidences, setEvidences] = useState<EvidenceInput[]>(initialEvidence)

  async function persistOnboardingStep(nextStep: Exclude<Step, "intro" | "done"> | "finish") {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth?.user) {
      router.replace("/login?next=/onboarding")
      return false
    }

    const { error } = await supabase
      .from("profiles")
      .update({ onboarding_step: nextStep })
      .eq("id", auth.user.id)

    if (error) {
      throw new Error(error.message || "No se ha podido guardar el avance.")
    }

    return true
  }

  async function handleSaveExperience() {
    if (!experience) return

    const roleTitle = String(experience.role_title || "").trim()
    const companyName = String(experience.company_name || "").trim()
    const startDate = normalizeDateForSave(experience.start_date)
    const endDate = currentRole ? null : normalizeDateForSave(experience.end_date)

    if (!roleTitle || !companyName || !startDate) {
      setExperienceMessage("Completa empresa, puesto y fecha de inicio para continuar.")
      return
    }

    setSavingExperience(true)
    setExperienceMessage(null)

    try {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth?.user) throw new Error("Tu sesión ha caducado. Vuelve a iniciar sesión.")

      if (experience.profile_experience_id) {
        const { error } = await supabase
          .from("profile_experiences")
          .update({
            role_title: roleTitle,
            company_name: companyName,
            start_date: startDate,
            end_date: endDate,
            description: String(experience.description || "").trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", experience.profile_experience_id)
          .eq("user_id", auth.user.id)

        if (error) throw new Error(error.message)
      } else {
        const { data, error } = await supabase
          .from("profile_experiences")
          .insert({
            user_id: auth.user.id,
            role_title: roleTitle,
            company_name: companyName,
            start_date: startDate,
            end_date: endDate,
            description: String(experience.description || "").trim() || null,
            matched_verification_id: null,
            confidence: null,
          })
          .select("id")
          .single()

        if (error || !data?.id) throw new Error(error?.message || "No se ha podido guardar la experiencia.")

        setExperience((prev) =>
          prev
            ? {
                ...prev,
                id: String(data.id),
                profile_experience_id: String(data.id),
              }
            : prev,
        )
      }

      await persistOnboardingStep("verification")
      setExperienceMessage("Experiencia añadida. Guardado correctamente.")
      setStep("verification")
    } catch (error: any) {
      setExperienceMessage(error?.message || "No hemos podido guardar la experiencia.")
    } finally {
      setSavingExperience(false)
    }
  }

  async function handleSendVerification() {
    if (!experience) return
    const email = String(verificationEmail || "").trim().toLowerCase()

    if (!EMAIL_RE.test(email)) {
      setVerificationError("Escribe un email válido o continúa más tarde desde tu perfil.")
      return
    }

    setSendingVerification(true)
    setVerificationMessage(null)
    setVerificationError(null)

    try {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth?.user?.id) throw new Error("Tu sesión ha caducado. Vuelve a iniciar sesión.")

      const payload = buildVerificationPayload(
        {
          ...experience,
          company_email: email,
        },
        auth.user.id,
        email,
      )

      const res = await fetch("/api/candidate/verification/create", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })

      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body?.details || body?.error || "No hemos podido enviar la solicitud.")
      }

      const nextVerification = {
        id: String(body?.id || body?.verification_request_id || ""),
        status: String(body?.already_exists ? "pending_company" : "pending_company"),
        requested_at: new Date().toISOString(),
        resolved_at: null,
        external_email_target: email,
        employment_record_id: String(body?.employment_record_id || experience.employment_record_id || ""),
      }

      setExperience((prev) =>
        prev
          ? {
              ...prev,
              employment_record_id: String(body?.employment_record_id || prev.employment_record_id || ""),
            }
          : prev,
      )
      setVerification(nextVerification)
      await persistOnboardingStep("evidence")
      setVerificationMessage(body?.already_exists ? "Pendiente de respuesta. Ya existía una solicitud activa." : "Solicitud enviada.")
      setStep("evidence")
    } catch (error: any) {
      setVerificationError(error?.message || "No hemos podido enviar la solicitud. Revisa el email e inténtalo de nuevo.")
    } finally {
      setSendingVerification(false)
    }
  }

  async function handleSkipVerification() {
    setVerificationMessage("Puedes añadirlo más tarde desde tu perfil.")
    setVerificationError(null)
    try {
      await persistOnboardingStep("evidence")
      setStep("evidence")
    } catch (error: any) {
      setVerificationError(error?.message || "No hemos podido guardar tu avance.")
    }
  }

  async function completeOnboarding(finalEvidenceMessage?: string | null) {
    if (completing) return
    setCompleting(true)
    try {
      await persistOnboardingStep("finish")
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ onboarding_step: "finish" }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body?.details || body?.error || "No hemos podido cerrar tu onboarding.")
      }
      if (finalEvidenceMessage) {
        setEvidenceMessage(finalEvidenceMessage)
      }
      setStep("done")
    } catch (error: any) {
      setEvidenceMessage(error?.message || "Tu perfil está en marcha, pero no hemos podido cerrar el onboarding.")
    } finally {
      setCompleting(false)
    }
  }

  async function uploadEvidence(file: File) {
    if (!verification?.employment_record_id && !experience?.employment_record_id) {
      setEvidenceMessage("Primero envía la solicitud de verificación para poder asociar un documento.")
      return
    }

    setUploadingEvidence(true)
    setEvidenceMessage(null)

    try {
      const buffer = await file.arrayBuffer()
      const digest = await crypto.subtle.digest("SHA-256", buffer)
      const fileHash = Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")

      const uploadUrlRes = await fetch("/api/candidate/evidence/upload-url", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          employment_record_id: verification?.employment_record_id || experience?.employment_record_id || null,
          mime: file.type || "application/octet-stream",
          size_bytes: file.size,
          filename: file.name,
          evidence_type: "otro_documento",
          file_sha256: fileHash,
        }),
      })
      const uploadUrlBody = await uploadUrlRes.json().catch(() => ({}))
      if (!uploadUrlRes.ok || !uploadUrlBody?.signed_url || !uploadUrlBody?.storage_path || !uploadUrlBody?.verification_request_id) {
        throw new Error(uploadUrlBody?.error || "No hemos podido preparar la subida del documento.")
      }

      const putRes = await fetch(uploadUrlBody.signed_url, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      })
      if (!putRes.ok) {
        throw new Error("No hemos podido subir el documento. Puedes reintentarlo o continuar más tarde.")
      }

      const confirmRes = await fetch("/api/candidate/evidence/confirm", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          verification_request_id: uploadUrlBody.verification_request_id,
          storage_path: uploadUrlBody.storage_path,
          evidence_type: "otro_documento",
          file_sha256: fileHash,
        }),
      })
      const confirmBody = await confirmRes.json().catch(() => ({}))
      if (!confirmRes.ok) {
        throw new Error(confirmBody?.error || "Hemos recibido el documento, pero no hemos podido registrarlo.")
      }

      setEvidences((prev) => [
        {
          id: String(confirmBody?.evidence_id || `local-${Date.now()}`),
          document_type: "Documento",
          created_at: new Date().toISOString(),
          validation_status: "uploaded",
        },
        ...prev,
      ])

      await completeOnboarding("Documento subido. Tu perfil ya está en marcha.")
    } catch (error: any) {
      setEvidenceMessage(error?.message || "No hemos podido subir el documento.")
    } finally {
      setUploadingEvidence(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const trustMessage =
    initialTrustScore >= 60 || verification?.status === "verified" || evidences.length > 0
      ? "Tu perfil ya transmite confianza"
      : "Completa una validación más para reforzar tu perfil"

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold text-slate-700">
            {step === "intro" ? "Paso 0 de 3 · Inicio" : step === "done" ? "Paso 3 de 3 · Perfil iniciado" : stepTitle(step)}
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-slate-900 transition-all"
              style={{
                width: `${
                  step === "intro" ? 8 : step === "experience" ? 33 : step === "verification" ? 66 : 100
                }%`,
              }}
            />
          </div>
        </section>

        {step === "intro" ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">VERIJOB</div>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">Demuestra tu experiencia laboral en minutos</h1>
            <p className="mt-3 text-base text-slate-600">Empieza validando tu primera experiencia</p>
            <button
              type="button"
              onClick={() => setStep("experience")}
              className="mt-8 inline-flex rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black"
            >
              Validar mi primera experiencia
            </button>
            <p className="mt-4 text-sm text-slate-500">Tardarás unos 2 minutos</p>
          </section>
        ) : null}

        {step !== "intro" && step !== "done" ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            {step === "experience" ? (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">Tu primera experiencia</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Añade una experiencia real para empezar a validar tu perfil.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <div className="mb-1 text-sm font-semibold text-slate-900">Empresa</div>
                    <input
                      value={experience?.company_name || ""}
                      onChange={(e) => setExperience((prev) => prev ? { ...prev, company_name: e.target.value } : prev)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                    />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-sm font-semibold text-slate-900">Puesto</div>
                    <input
                      value={experience?.role_title || ""}
                      onChange={(e) => setExperience((prev) => prev ? { ...prev, role_title: e.target.value } : prev)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                    />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-sm font-semibold text-slate-900">Fecha inicio</div>
                    <input
                      type="month"
                      lang="es"
                      value={String(experience?.start_date || "").slice(0, 7)}
                      onChange={(e) => setExperience((prev) => prev ? { ...prev, start_date: e.target.value } : prev)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                    />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-sm font-semibold text-slate-900">Fecha fin</div>
                    <input
                      type="month"
                      lang="es"
                      disabled={currentRole}
                      value={String(experience?.end_date || "").slice(0, 7)}
                      onChange={(e) => setExperience((prev) => prev ? { ...prev, end_date: e.target.value } : prev)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-100"
                    />
                  </label>
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={currentRole}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setCurrentRole(checked)
                      if (checked) {
                        setExperience((prev) => prev ? { ...prev, end_date: "" } : prev)
                      }
                    }}
                  />
                  Sigo trabajando aquí
                </label>

                {experienceMessage ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    {experienceMessage}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => void handleSaveExperience()}
                  disabled={savingExperience}
                  className="inline-flex rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                >
                  {savingExperience ? "Guardando…" : "Continuar"}
                </button>
              </div>
            ) : null}

            {step === "verification" ? (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">Verifica esta experiencia para que las empresas confíen en ti</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Usaremos el email de empresa para enviar la solicitud de validación.
                  </p>
                  <p className="mt-1 text-sm text-slate-500">Puedes añadirlo más tarde desde tu perfil.</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="font-semibold text-slate-900">{experience?.role_title || "Puesto"}</div>
                  <div className="mt-1">{experience?.company_name || "Empresa"}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {formatMonth(experience?.start_date)} — {currentRole ? "Actualidad" : formatMonth(experience?.end_date)}
                  </div>
                </div>

                <label className="block">
                  <div className="mb-1 text-sm font-semibold text-slate-900">Email de empresa</div>
                  <input
                    type="email"
                    value={verificationEmail}
                    onChange={(e) => setVerificationEmail(e.target.value)}
                    placeholder="rrhh@empresa.com"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                  />
                </label>

                {verification ? (
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                    {humanVerificationStatus(verification.status) === "Pendiente de respuesta"
                      ? "Pendiente de respuesta"
                      : `Estado actual: ${humanVerificationStatus(verification.status)}`}
                  </div>
                ) : null}

                {verificationMessage ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    {verificationMessage}
                  </div>
                ) : null}

                {verificationError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    {verificationError}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (verification?.id) {
                        setStep("evidence")
                        return
                      }
                      void handleSendVerification()
                    }}
                    disabled={sendingVerification}
                    className="inline-flex rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                  >
                    {sendingVerification
                      ? "Enviando…"
                      : verification?.id
                        ? "Continuar"
                        : "Enviar solicitud de verificación"}
                  </button>
                  {!verification?.id ? (
                    <button
                      type="button"
                      onClick={() => void handleSkipVerification()}
                      disabled={sendingVerification}
                      className="inline-flex rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Lo haré más tarde
                    </button>
                  ) : null}
                  {verificationError ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleSendVerification()}
                        disabled={sendingVerification}
                        className="inline-flex rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Reintentar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setVerificationError(null)
                          setVerificationMessage(null)
                        }}
                        disabled={sendingVerification}
                        className="inline-flex rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Cambiar email
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}

            {step === "evidence" ? (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">Aumenta tu nivel de confianza subiendo documentación (opcional)</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Puedes reforzar tu perfil con un documento y continuar igualmente si prefieres hacerlo más tarde.
                  </p>
                </div>

                {evidences.length > 0 ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    Documento subido.
                  </div>
                ) : null}

                {evidenceMessage ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {evidenceMessage}
                  </div>
                ) : null}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void uploadEvidence(file)
                  }}
                />

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingEvidence || completing}
                    className="inline-flex rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                  >
                    {uploadingEvidence ? "Subiendo…" : "Subir documento"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void completeOnboarding("Puedes continuar más tarde. Tu perfil ya está en marcha.")}
                    disabled={completing || uploadingEvidence}
                    className="inline-flex rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {completing ? "Terminando…" : "Saltar por ahora"}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {step === "done" ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Perfil iniciado correctamente</div>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">Tu perfil ya está en marcha</h1>
            <p className="mt-2 text-sm text-slate-600">Has dado el primer paso para convertir tu experiencia en una señal de confianza real.</p>
            <div className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
              <div className="flex items-center justify-between gap-3">
                <span>Experiencia creada</span>
                <span className="font-semibold text-slate-900">
                  {experience?.company_name ? `${experience.company_name} · ${experience.role_title}` : "Sí"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Estado de verificación</span>
                <span className="font-semibold text-slate-900">{humanVerificationStatus(verification?.status)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Documentación</span>
                <span className="font-semibold text-slate-900">
                  {evidences.length > 0 ? evidences[0]?.document_type || "Documento subido" : "Sin documento por ahora"}
                </span>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
              {trustMessage}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/candidate/experience?new=1#manual-experience"
                className="inline-flex rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black"
              >
                Añadir otra experiencia
              </Link>
              <Link
                href="/candidate/profile"
                className="inline-flex rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Ver mi perfil
              </Link>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}
