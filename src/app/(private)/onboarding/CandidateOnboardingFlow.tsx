"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type Step = "intro" | "experience" | "verification" | "done"

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
  return "Sin validar todavía"
}

function deriveInitialStep(args: {
  onboardingStep: string | null
  experience: ExperienceInput | null
  verification: VerificationInput | null
  evidenceCount: number
}) {
  if (args.onboardingStep === "finish") return "done" as const
  if (!args.experience) return "intro" as const
  if (args.verification || args.evidenceCount > 0 || args.onboardingStep === "verification" || args.onboardingStep === "evidence") {
    return "verification" as const
  }
  return "experience" as const
}

function stepLabel(step: Step) {
  if (step === "intro") return "Paso 1 de 3 · Crea la base de tu perfil"
  if (step === "experience") return "Paso 2 de 3 · Revisa tu historial"
  if (step === "verification") return "Paso 3 de 3 · Refuerza tu credibilidad"
  return "Paso 3 de 3 · Perfil activado"
}

function progressWidth(step: Step) {
  if (step === "intro") return 20
  if (step === "experience") return 66
  return 100
}

export default function CandidateOnboardingFlow({
  initialProfile,
  readiness,
  initialExperience,
  initialVerification,
  initialEvidence,
  initialTrustScore,
}: {
  initialProfile: { fullName: string | null; title: string | null; onboardingStep: string | null }
  readiness: { hasFullName: boolean; hasTitle: boolean; hasExperience: boolean; isReady: boolean }
  initialExperience: ExperienceInput | null
  initialVerification: VerificationInput | null
  initialEvidence: EvidenceInput[]
  initialTrustScore: number
}) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(
    deriveInitialStep({
      onboardingStep: initialProfile.onboardingStep,
      experience: initialExperience,
      verification: initialVerification,
      evidenceCount: initialEvidence.length,
    }),
  )
  const [completing, setCompleting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function persistOnboardingStep(nextStep: "experience" | "verification" | "evidence" | "finish") {
    const res = await fetch("/api/onboarding/complete", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ onboarding_step: nextStep }),
    })
    const body = await res.json().catch(() => ({}))
    if (res.status === 401) {
      router.replace("/login?next=/onboarding")
      return false
    }
    if (!res.ok) {
      throw new Error(body?.details || body?.error || "No se ha podido guardar el avance.")
    }
    return true
  }

  async function goToExperience(target: "cv" | "manual") {
    try {
      setMessage(null)
      await persistOnboardingStep("experience")
      document.cookie = "candidate_onboarding_access=1; Path=/; Max-Age=1800; SameSite=Lax"
      router.push(target === "cv" ? "/candidate/experience?onboarding=1#cv-upload" : "/candidate/experience?onboarding=1&new=1#manual-experience")
    } catch (error: any) {
      setMessage(error?.message || "No hemos podido abrir tu bandeja de experiencias.")
    }
  }

  function goToProfileBasics() {
    document.cookie = "candidate_onboarding_access=1; Path=/; Max-Age=1800; SameSite=Lax"
    router.push("/candidate/profile?onboarding=1")
  }

  async function continueToReview() {
    try {
      setMessage(null)
      await persistOnboardingStep("verification")
      setStep("verification")
    } catch (error: any) {
      setMessage(error?.message || "No hemos podido guardar tu avance.")
    }
  }

  async function completeOnboarding() {
    if (completing) return
    setCompleting(true)
    setMessage(null)
    try {
      await persistOnboardingStep("finish")
      document.cookie = "candidate_onboarding_access=; Path=/; Max-Age=0; SameSite=Lax"
      setStep("done")
    } catch (error: any) {
      setMessage(error?.message || "Tu perfil está en marcha, pero no hemos podido cerrar el onboarding.")
    } finally {
      setCompleting(false)
    }
  }

  const verificationStatus = humanVerificationStatus(initialVerification?.status)
  const trustMessage =
    initialTrustScore >= 60 || verificationStatus === "Verificada" || initialEvidence.length > 0
      ? "Tu perfil ya transmite confianza"
      : "Tu perfil ya empieza a transmitir valor real"
  const missingBasics = !readiness.hasFullName || !readiness.hasTitle

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <section className="mb-8 rounded-[32px] border border-slate-200 bg-white p-7 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-700">{stepLabel(step)}</div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Activa un perfil que una empresa pueda creer</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">No se trata solo de rellenar datos. Se trata de convertir tu trayectoria en una señal más fuerte.</p>
            </div>
            <div className="min-w-[180px] rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Progreso</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{progressWidth(step)}%</p>
            </div>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${progressWidth(step)}%` }} />
          </div>
          <p className="mt-4 text-sm text-slate-600">Cada paso reduce fricción y mejora cómo te verán.</p>
        </section>

        {message ? (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
            {message}
          </div>
        ) : null}

        {!readiness.isReady ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 shadow-sm">
            <p className="font-semibold">Antes de cerrar tu onboarding necesitas una base mínima real.</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
              <span className={`rounded-full border px-3 py-1 ${readiness.hasFullName ? "border-emerald-200 bg-white text-emerald-700" : "border-amber-300 bg-white text-amber-900"}`}>
                {readiness.hasFullName ? "Nombre y apellidos completos" : "Completa nombre y apellidos"}
              </span>
              <span className={`rounded-full border px-3 py-1 ${readiness.hasTitle ? "border-emerald-200 bg-white text-emerald-700" : "border-amber-300 bg-white text-amber-900"}`}>
                {readiness.hasTitle ? "Titular profesional listo" : "Añade tu titular profesional"}
              </span>
              <span className={`rounded-full border px-3 py-1 ${readiness.hasExperience ? "border-emerald-200 bg-white text-emerald-700" : "border-amber-300 bg-white text-amber-900"}`}>
                {readiness.hasExperience ? "Experiencia registrada" : "Añade al menos una experiencia"}
              </span>
            </div>
          </div>
        ) : null}

        {step === "intro" ? (
          <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">VERIJOB</div>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">Crea la base de tu perfil</h1>
            <p className="mt-3 text-base text-slate-600">
              Sin base profesional clara, no puedes construir una señal fuerte después.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => void goToExperience("cv")}
                className="inline-flex min-h-16 items-center justify-center rounded-2xl bg-slate-900 px-5 py-4 text-sm font-semibold text-white hover:bg-black"
              >
                Importar mi CV
              </button>
              <button
                type="button"
                onClick={() => void goToExperience("manual")}
                className="inline-flex min-h-16 items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Crear perfil manualmente
              </button>
            </div>

            <p className="mt-4 text-sm text-slate-500">Primero crea tu base. Luego podrás reforzarla con verificaciones y evidencias.</p>

            {missingBasics ? (
              <button
                type="button"
                onClick={goToProfileBasics}
                className="mt-6 inline-flex rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Completar datos básicos
              </button>
            ) : null}

            {initialExperience ? (
              <button
                type="button"
                onClick={() => setStep("experience")}
                className="mt-6 inline-flex rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Continuar con mi historial
              </button>
            ) : null}
          </section>
        ) : null}

        {step === "experience" ? (
          <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Limpia y confirma tu historial</h2>
              <p className="mt-2 text-sm text-slate-600">
                Un historial confuso o incompleto resta credibilidad antes incluso de verificar nada.
              </p>
            </div>

            {initialExperience ? (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">{initialExperience.role_title || "Puesto pendiente"}</div>
                <div className="mt-1 text-sm text-slate-700">{initialExperience.company_name || "Empresa pendiente"}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {formatMonth(initialExperience.start_date)} — {initialExperience.end_date ? formatMonth(initialExperience.end_date) : "Actualidad"}
                </div>
                <div className="mt-3 text-xs text-slate-600">
                  Puedes revisarla desde tu bandeja de experiencias antes de solicitar una verificación o vincular documentación.
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Todavía no hay experiencias creadas. Empieza importando tu CV o añadiendo tu primera experiencia manualmente.
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void goToExperience("cv")}
                className="inline-flex rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Revisar CV importado
              </button>
              <button
                type="button"
                onClick={() => void goToExperience("manual")}
                className="inline-flex rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Editar historial manualmente
              </button>
              {initialExperience ? (
                <button
                  type="button"
                  onClick={() => void continueToReview()}
                  className="inline-flex rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black"
                >
                  Continuar y reforzar perfil
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {step === "verification" ? (
          <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Añade señales que te diferencien</h2>
              <p className="mt-2 text-sm text-slate-600">
                Las verificaciones y evidencias son lo que convierte tu perfil en una ventaja real.
              </p>
            </div>

            <div className="mt-7 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Experiencia</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {initialExperience ? "Base profesional creada" : "Pendiente de revisar"}
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {initialExperience
                    ? `${initialExperience.role_title || "Experiencia"} en ${initialExperience.company_name || "tu empresa"}`
                    : "Añade tu primera experiencia para empezar a construir el perfil."}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Validación</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{verificationStatus}</div>
                <p className="mt-1 text-xs text-slate-600">
                  {initialVerification?.external_email_target
                    ? `Solicitud enviada a ${initialVerification.external_email_target}.`
                    : "Todavía puedes solicitar una validación más adelante desde tu historial."}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Evidencias</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {initialEvidence.length > 0 ? "Con documentación aportada" : "Todavía opcional"}
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {initialEvidence.length > 0
                    ? `${initialEvidence.length} documento${initialEvidence.length === 1 ? "" : "s"} subido${initialEvidence.length === 1 ? "" : "s"}.`
                    : "Puedes subir documentación más tarde para reforzar tu perfil."}
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {missingBasics ? (
                <button
                  type="button"
                  onClick={goToProfileBasics}
                  className="inline-flex rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Completar datos básicos
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => router.push("/candidate/experience?onboarding=1")}
                className="inline-flex rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Abrir historial de experiencias
              </button>
              <button
                type="button"
                onClick={() => void completeOnboarding()}
                disabled={completing || !readiness.isReady}
                className="inline-flex rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
              >
                {completing ? "Guardando…" : "Ir a mi dashboard"}
              </button>
            </div>
            {!readiness.isReady ? (
              <p className="mt-4 text-sm text-slate-500">
                Completa nombre y apellidos, titular profesional y al menos una experiencia antes de entrar al dashboard.
              </p>
            ) : null}
          </section>
        ) : null}

        {step === "done" ? (
          <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Perfil activado</div>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">Ya tienes una base. Ahora toca hacerla destacar.</h1>
            <p className="mt-3 text-base text-slate-600">Tu perfil ya está activo, pero todavía puede ganar mucha más fuerza si verificas experiencia o subes evidencias.</p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Experiencia creada</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {initialExperience ? `${initialExperience.role_title || "Experiencia"} en ${initialExperience.company_name || "empresa"}` : "Pendiente"}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Estado de verificación</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{verificationStatus}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Documentación</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {initialEvidence.length > 0 ? "Con documentación aportada" : "Puedes añadirla más tarde"}
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => router.push("/candidate/experience?new=1#manual-experience")}
                className="inline-flex rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black"
              >
                Añadir otra experiencia
              </button>
              <button
                type="button"
                onClick={() => router.push("/candidate/overview")}
                className="inline-flex rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Ver mi dashboard
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}
