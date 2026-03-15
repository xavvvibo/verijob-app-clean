"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { vjEvents } from "@/lib/analytics";
import CvUploadAndParse from "@/components/candidate/profile/CvUploadAndParse";

export const dynamic = "force-dynamic";

type StepKey = "cv" | "experience" | "education" | "achievements" | "finish";

const STEP_ORDER: StepKey[] = ["cv", "experience", "education", "achievements", "finish"];

function normalizeStep(value: string | null | undefined): StepKey {
  const raw = String(value || "").toLowerCase();
  if (raw === "experience") return "experience";
  if (raw === "education") return "education";
  if (raw === "achievements") return "achievements";
  if (raw === "finish" || raw === "final") return "finish";
  return "cv";
}

function nextStep(step: StepKey): StepKey {
  const idx = STEP_ORDER.indexOf(step);
  return STEP_ORDER[Math.min(idx + 1, STEP_ORDER.length - 1)] || "finish";
}

function StepCard({
  title,
  description,
  status,
}: {
  title: string;
  description: string;
  status: "pending" | "current" | "done";
}) {
  const badgeClass =
    status === "done"
      ? "bg-emerald-50 text-emerald-700"
      : status === "current"
      ? "bg-blue-50 text-blue-700"
      : "bg-amber-50 text-amber-700";

  const badgeLabel = status === "done" ? "Revisado" : status === "current" ? "En curso" : "Pendiente";

  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass}`}>{badgeLabel}</div>
      </div>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<StepKey>("cv");

  const blockedGate = searchParams.get("blocked") === "1";
  const blockedSource = searchParams.get("source");
  const sourceLabel =
    blockedSource === "candidate"
      ? "perfil candidato"
      : blockedSource === "dashboard"
      ? "dashboard"
      : "otras secciones privadas";

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setErr(null);
      setLoading(true);

      const { data: au } = await supabase.auth.getUser();
      const user = au.user;

      if (!user) {
        if (!cancelled) router.replace("/login?next=/onboarding");
        return;
      }

      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("id, role, onboarding_completed, onboarding_step")
        .eq("id", user.id)
        .maybeSingle();

      if (pErr) {
        if (!cancelled) setErr("No se pudo leer tu perfil. Intenta recargar.");
      } else if (String(profile?.role || "").toLowerCase() === "company") {
        if (!cancelled) router.replace("/onboarding/company?blocked=1&source=onboarding");
        return;
      } else if (profile?.onboarding_completed) {
        if (!cancelled) router.replace("/dashboard");
        return;
      } else if (!cancelled) {
        const stepFromUrl = normalizeStep(searchParams.get("step"));
        const stepFromProfile = normalizeStep(profile?.onboarding_step);
        setCurrentStep(searchParams.get("step") ? stepFromUrl : stepFromProfile);
      }

      if (!cancelled) setLoading(false);
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams, supabase]);

  const stepIndex = STEP_ORDER.indexOf(currentStep);
  const progressPct = Math.round(((stepIndex + 1) / STEP_ORDER.length) * 100);

  async function persistStep(step: StepKey) {
    const { data: au } = await supabase.auth.getUser();
    const user = au.user;
    if (!user) {
      router.replace("/login?next=/onboarding");
      return false;
    }

    const { error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          onboarding_step: step,
        },
        { onConflict: "id" },
      );

    if (error) {
      setErr(error.message || "No se pudo guardar el avance.");
      return false;
    }

    return true;
  }

  async function moveTo(step: StepKey, analyticsStep?: "experience" | "education" | "achievements") {
    setErr(null);
    setSaving(true);
    try {
      const ok = await persistStep(step);
      if (!ok) return;
      if (analyticsStep) {
        vjEvents.onboarding_step_completed(analyticsStep);
        vjEvents.profile_section_completed(analyticsStep);
      }
      setCurrentStep(step);
    } catch (e: any) {
      setErr(e?.message || "No se pudo actualizar el onboarding.");
    } finally {
      setSaving(false);
    }
  }

  async function onFinish() {
    setErr(null);
    setSaving(true);

    try {
      const { data: au } = await supabase.auth.getUser();
      const user = au.user;
      if (!user) {
        router.replace("/login?next=/onboarding");
        return;
      }

      const ok = await persistStep("finish");
      if (!ok) return;

      const completeRes = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ onboarding_step: "finish" }),
      });
      const completeData = await completeRes.json().catch(() => ({}));
      if (!completeRes.ok) {
        throw new Error(completeData?.details || completeData?.error || "No se pudo completar el onboarding.");
      }

      vjEvents.onboarding_step_completed("achievements");
      vjEvents.profile_section_completed("achievements");
      vjEvents.onboarding_completed("candidate");

      router.replace("/candidate/profile");
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "No se pudo completar el onboarding.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-3xl border bg-white p-8 shadow-sm">
          <div className="text-sm text-slate-600">Cargando…</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-3xl border bg-white p-8 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Onboarding candidato
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">
              Completa tu perfil inicial sin bloquear tu edición
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              Empieza importando tu CV o continúa de forma manual. Puedes saltar pasos y volver más tarde a cualquier sección.
            </p>
            {blockedGate ? (
              <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                <div className="font-semibold">Tu cuenta aún no ha terminado el onboarding</div>
                <p className="mt-1">
                  Hemos bloqueado temporalmente el acceso al {sourceLabel} para evitar acciones con el perfil incompleto.
                  Aun así, ya puedes abrir experiencia, formación y logros para completar tu información real.
                </p>
              </div>
            ) : null}

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                <span>Progreso orientativo</span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-slate-900" style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            <div className="mt-8 space-y-4">
              {[
                {
                  key: "cv",
                  title: "1. Importar CV",
                  description: "Sube tu CV para extraer experiencia, formación e idiomas automáticamente. Puedes omitirlo.",
                },
                {
                  key: "experience",
                  title: "2. Experiencia laboral",
                  description: "Abre la sección real de experiencia para añadir, editar y guardar tu historial profesional.",
                },
                {
                  key: "education",
                  title: "3. Formación académica",
                  description: "Añade estudios desde la ruta real de educación. No hace falta completarlo todo ahora.",
                },
                {
                  key: "achievements",
                  title: "4. Idiomas y otros logros",
                  description: "Gestiona idiomas, certificaciones y otros logros desde la sección específica.",
                },
                {
                  key: "finish",
                  title: "5. Finalizar onboarding",
                  description: "Cierra el perfil inicial y sigue completándolo después desde tu área candidata.",
                },
              ].map((step, index) => (
                <StepCard
                  key={step.key}
                  title={step.title}
                  description={step.description}
                  status={index < stepIndex ? "done" : index === stepIndex ? "current" : "pending"}
                />
              ))}
            </div>
          </section>

          <section id="onboarding-action-panel" className="rounded-3xl border bg-white p-8 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">
              Paso actual: {
                currentStep === "cv"
                  ? "Importar CV"
                  : currentStep === "experience"
                  ? "Experiencia laboral"
                  : currentStep === "education"
                  ? "Formación académica"
                  : currentStep === "achievements"
                  ? "Idiomas y otros logros"
                  : "Finalizar onboarding"
              }
            </div>

            {currentStep === "cv" ? (
              <div className="mt-6 space-y-5">
                <div className="rounded-2xl border bg-slate-50 p-4">
                  <div className="text-base font-semibold text-slate-900">Importa tu CV para empezar más rápido</div>
                  <p className="mt-2 text-sm text-slate-600">
                    Puedes subir tu CV, extraer información automáticamente o saltar este paso y completar el onboarding manualmente.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="text-sm font-semibold text-slate-900">Subir CV</div>
                    <p className="mt-2 text-sm text-slate-600">Carga un PDF o DOCX para arrancar con datos reales.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="text-sm font-semibold text-slate-900">Extraer información automáticamente</div>
                    <p className="mt-2 text-sm text-slate-600">La experiencia, la formación y los idiomas se preparan para que puedas revisarlos.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="text-sm font-semibold text-slate-900">Omitir este paso</div>
                    <p className="mt-2 text-sm text-slate-600">Puedes seguir manualmente y volver a importar tu CV más adelante.</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <CvUploadAndParse />
                </div>

                <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700">
                  Cuando termines de importar, revisa experiencia, formación e idiomas antes de cerrar el onboarding. Si prefieres, puedes seguir manualmente desde ahora mismo.
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => moveTo("experience")}
                    className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900 disabled:opacity-60"
                  >
                    {saving ? "Guardando…" : "Omitir este paso"}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => moveTo("experience")}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                  >
                    Continuar al siguiente paso
                  </button>
                </div>
              </div>
            ) : null}

            {currentStep === "experience" ? (
              <div className="mt-6 space-y-5">
                <p className="text-sm text-slate-600">
                  Abre la sección real de experiencia para añadir, editar y guardar tus empleos. Puedes volver aquí después sin perder el hilo del onboarding.
                </p>
                <Link
                  href="/candidate/experience"
                  className="inline-flex w-full items-center justify-center rounded-xl border px-4 py-3 text-sm font-medium text-slate-900"
                >
                  Ir a experiencia laboral
                </Link>
                <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700">
                  Puedes volver aquí cuando quieras. Si todavía no añades nada, también puedes continuar manualmente.
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => moveTo(nextStep("experience"), "experience")}
                  className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving ? "Guardando…" : "Continuar a formación académica"}
                </button>
              </div>
            ) : null}

            {currentStep === "education" ? (
              <div className="mt-6 space-y-5">
                <p className="text-sm text-slate-600">
                  Añade tus estudios desde la ruta real de educación. Puedes guardar uno, varios o ninguno por ahora y continuar sin bloquearte.
                </p>
                <Link
                  href="/candidate/education"
                  className="inline-flex w-full items-center justify-center rounded-xl border px-4 py-3 text-sm font-medium text-slate-900"
                >
                  Añadir estudios
                </Link>
                <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700">
                  Si lo prefieres, continúa y vuelve más tarde. El perfil seguirá siendo editable.
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => moveTo(nextStep("education"), "education")}
                  className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving ? "Guardando…" : "Continuar a idiomas y logros"}
                </button>
              </div>
            ) : null}

            {currentStep === "achievements" ? (
              <div className="mt-6 space-y-5">
                <p className="text-sm text-slate-600">
                  Esta sección ya separa idiomas, certificaciones y otros logros. Entra y añade solo lo que tengas listo ahora.
                </p>
                <div className="grid gap-3">
                  <Link
                    href="/candidate/achievements?open=language"
                    className="inline-flex w-full items-center justify-center rounded-xl border px-4 py-3 text-sm font-medium text-slate-900"
                  >
                    Añadir idioma
                  </Link>
                  <Link
                    href="/candidate/achievements?open=certification"
                    className="inline-flex w-full items-center justify-center rounded-xl border px-4 py-3 text-sm font-medium text-slate-900"
                  >
                    Añadir certificación
                  </Link>
                  <Link
                    href="/candidate/achievements?open=achievement"
                    className="inline-flex w-full items-center justify-center rounded-xl border px-4 py-3 text-sm font-medium text-slate-900"
                  >
                    Añadir logro
                  </Link>
                </div>
                <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700">
                  Los idiomas se mostrarán con formato laboral claro, por ejemplo <span className="font-semibold">English — C2</span>.
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => moveTo(nextStep("achievements"), "achievements")}
                  className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving ? "Guardando…" : "Ir al paso final"}
                </button>
              </div>
            ) : null}

            {currentStep === "finish" ? (
              <div className="mt-6 space-y-5">
                <div className="rounded-2xl border bg-emerald-50 p-4 text-emerald-900">
                  <div className="text-base font-semibold">Tu perfil inicial está listo</div>
                  <p className="mt-2 text-sm">
                    Ya puedes cerrar este onboarding y seguir completando tu perfil cuando quieras.
                  </p>
                </div>

                <div className="grid gap-3">
                  <Link
                    href="/candidate/profile"
                    className="inline-flex w-full items-center justify-center rounded-xl border px-4 py-3 text-sm font-medium text-slate-900"
                  >
                    Ver perfil
                  </Link>
                  <Link
                    href="/candidate/experience"
                    className="inline-flex w-full items-center justify-center rounded-xl border px-4 py-3 text-sm font-medium text-slate-900"
                  >
                    Añadir más información
                  </Link>
                  <Link
                    href="/candidate/verifications/new"
                    className="inline-flex w-full items-center justify-center rounded-xl border px-4 py-3 text-sm font-medium text-slate-900"
                  >
                    Solicitar verificación
                  </Link>
                </div>

                <button
                  type="button"
                  disabled={saving}
                  onClick={onFinish}
                  className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving ? "Finalizando…" : "Finalizar onboarding"}
                </button>
              </div>
            ) : null}

            {err ? (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {err}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
