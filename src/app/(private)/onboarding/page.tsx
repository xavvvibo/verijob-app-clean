"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { vjEvents } from "@/lib/analytics";

export const dynamic = "force-dynamic";

type StepKey = "personal" | "experience" | "education" | "achievements";

function isStrongEnough(pw: string) {
  return (pw || "").length >= 8;
}

function StepCard({
  title,
  description,
  done,
}: {
  title: string;
  description: string;
  done: boolean;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            done ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {done ? "Listo" : "Pendiente"}
        </div>
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

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  const [profileVisibility, setProfileVisibility] = useState("private");
  const [showPersonal, setShowPersonal] = useState(true);
  const [showExperience, setShowExperience] = useState(true);
  const [showEducation, setShowEducation] = useState(true);
  const [showAchievements, setShowAchievements] = useState(true);

  const [currentStep, setCurrentStep] = useState<StepKey>("personal");
  const blockedGate = searchParams.get("blocked") === "1";
  const blockedSource = searchParams.get("source");
  const sourceLabel =
    blockedSource === "candidate"
      ? "perfil candidato"
      : blockedSource === "dashboard"
      ? "dashboard"
      : "otras secciones privadas";
  const isPasswordOptional = pw.length === 0 && pw2.length === 0;
  const personalStepDone = isPasswordOptional || (isStrongEnough(pw) && pw === pw2);

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
        .select(
          "id, onboarding_completed, onboarding_step, profile_visibility, show_personal, show_experience, show_education, show_achievements"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (pErr) {
        if (!cancelled) setErr("No se pudo leer tu perfil. Intenta recargar.");
      } else if (profile?.onboarding_completed) {
        if (!cancelled) router.replace("/dashboard");
        return;
      } else {
        if (!cancelled) {
          setProfileVisibility(profile?.profile_visibility ?? "private");
          setShowPersonal(profile?.show_personal ?? true);
          setShowExperience(profile?.show_experience ?? true);
          setShowEducation(profile?.show_education ?? true);
          setShowAchievements(profile?.show_achievements ?? true);
          setCurrentStep((profile?.onboarding_step as StepKey) ?? "personal");
        }
      }

      if (!cancelled) setLoading(false);
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  const steps = [
    {
      key: "personal" as StepKey,
      title: "Datos personales",
      description: "Configura visibilidad de perfil y, si quieres, define una contraseña de respaldo.",
      done: currentStep === "personal" ? personalStepDone : true,
    },
    {
      key: "experience" as StepKey,
      title: "Experiencia laboral",
      description: "Añade o revisa tu experiencia laboral para que tu CV verificable tenga base real.",
      done: currentStep === "education" || currentStep === "achievements",
    },
    {
      key: "education" as StepKey,
      title: "Datos académicos",
      description: "Incluye tu formación académica y verifícala para reforzar el valor de tu perfil.",
      done: currentStep === "achievements",
    },
    {
      key: "achievements" as StepKey,
      title: "Otros logros",
      description: "Añade certificados, premios u otros hitos. Si no tienes nada ahora, esta sección podrá quedar mínima.",
      done: false,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const progressPct = Math.round((completedCount / steps.length) * 100);

  async function savePreferences(step: StepKey) {
    const { data: au } = await supabase.auth.getUser();
    const user = au.user;
    if (!user) {
      router.replace("/login?next=/onboarding");
      return false;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        onboarding_step: step,
        profile_visibility: profileVisibility,
        show_personal: showPersonal,
        show_experience: showExperience,
        show_education: showEducation,
        show_achievements: showAchievements,
      })
      .eq("id", user.id);

    if (error) {
      setErr(error.message || "No se pudieron guardar las preferencias.");
      return false;
    }

    return true;
  }

  async function onContinue(step: StepKey) {
    setErr(null);

    if (step === "personal" && !isPasswordOptional) {
      if (!isStrongEnough(pw)) {
        setErr("Si defines contraseña, debe tener al menos 8 caracteres.");
        return;
      }
      if (pw !== pw2) {
        setErr("Las contraseñas no coinciden.");
        return;
      }
    }

    setSaving(true);
    try {
      const { data: au } = await supabase.auth.getUser();
      const user = au.user;
      if (!user) {
        router.replace("/login?next=/onboarding");
        return;
      }

      if (step === "personal" && !isPasswordOptional) {
        const { error: upErr } = await supabase.auth.updateUser({ password: pw });
        if (upErr) throw upErr;
      }

      const nextMap: Record<StepKey, StepKey> = {
        personal: "experience",
        experience: "education",
        education: "achievements",
        achievements: "achievements",
      };

      const ok = await savePreferences(nextMap[step]);
      if (!ok) return;

      vjEvents.onboarding_step_completed(step);
      vjEvents.profile_section_completed(step);
      setCurrentStep(nextMap[step]);
    } catch (e: any) {
      setErr(e?.message || "No se pudo continuar.");
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

      const ok = await savePreferences("achievements");
      if (!ok) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          onboarding_completed: true,
          onboarding_step: "achievements",
        })
        .eq("id", user.id);

      if (error) throw error;

      vjEvents.onboarding_step_completed("achievements");
      vjEvents.profile_section_completed("achievements");
      vjEvents.onboarding_completed("candidate");

      router.replace("/dashboard");
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
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border bg-white p-8 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Onboarding candidato
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">
              Construye tu CV verificable paso a paso
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              Te guiaremos por cuatro bloques: datos personales, experiencia laboral, datos académicos y otros logros.
            </p>
            {blockedGate ? (
              <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                <div className="font-semibold">Tu cuenta aún no ha terminado el onboarding</div>
                <p className="mt-1">
                  Hemos bloqueado temporalmente el acceso al {sourceLabel} para evitar acciones con el perfil incompleto.
                  Completa los pasos de esta pantalla para desbloquear el resto del área candidata.
                </p>
              </div>
            ) : null}

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                <span>Progreso</span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-slate-900" style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <StepCard
                title="1. Datos personales"
                description="Configura visibilidad y seguridad básica de cuenta."
                done={currentStep === "personal" ? personalStepDone : true}
              />
              <StepCard
                title="2. Experiencia laboral"
                description="Tu historial laboral es la base principal del CV verificable."
                done={showExperience}
              />
              <StepCard
                title="3. Datos académicos"
                description="Añade tu formación para enriquecer el perfil y mejorar su lectura."
                done={showEducation}
              />
              <StepCard
                title="4. Otros logros"
                description="Premios, cursos o certificaciones. Si está vacío, podrá mantenerse discreto."
                done={true}
              />
            </div>
          </section>

          <section id="onboarding-action-panel" className="rounded-3xl border bg-white p-8 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">
              Paso actual: {currentStep === "personal" ? "Datos personales" :
                currentStep === "experience" ? "Experiencia laboral" :
                currentStep === "education" ? "Datos académicos" : "Otros logros"}
            </div>

            {currentStep === "personal" && (
              <div className="mt-6 space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Contraseña (opcional)</label>
                  <input
                    type="password"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Déjalo vacío para seguir con acceso por código email"
                    className="w-full rounded-xl border px-3 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Repite contraseña (opcional)</label>
                  <input
                    type="password"
                    value={pw2}
                    onChange={(e) => setPw2(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Solo si quieres guardar contraseña"
                    className="w-full rounded-xl border px-3 py-2.5 text-sm"
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Verijob permite acceso por código de email. La contraseña es opcional como método de respaldo.
                </p>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Visibilidad pública del perfil</label>
                  <select
                    value={profileVisibility}
                    onChange={(e) => setProfileVisibility(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2.5 text-sm"
                  >
                    <option value="private">Privado</option>
                    <option value="public">Público</option>
                    <option value="public_anonymous">Público anónimo</option>
                  </select>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-4">
                  <div className="text-sm font-medium text-slate-900">Secciones visibles</div>
                  <div className="mt-3 space-y-3 text-sm text-slate-700">
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={showPersonal} onChange={(e) => setShowPersonal(e.target.checked)} />
                      <span>Mostrar datos personales</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={showExperience} onChange={(e) => setShowExperience(e.target.checked)} />
                      <span>Mostrar experiencia laboral</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={showEducation} onChange={(e) => setShowEducation(e.target.checked)} />
                      <span>Mostrar datos académicos</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={showAchievements} onChange={(e) => setShowAchievements(e.target.checked)} />
                      <span>Mostrar otros logros</span>
                    </label>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onContinue("personal")}
                  className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving ? "Guardando…" : "Guardar y continuar"}
                </button>
              </div>
            )}

            {currentStep === "experience" && (
              <div className="mt-6 space-y-5">
                <p className="text-sm text-slate-600">
                  Añade tu experiencia laboral en Verijob. Es la parte más valiosa para que una empresa entienda tu recorrido real.
                </p>
                <a
                  href="/candidate/experience"
                  className="inline-flex w-full items-center justify-center rounded-xl border px-4 py-3 text-sm font-medium text-slate-900"
                >
                  Ir a experiencia laboral
                </a>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onContinue("experience")}
                  className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving ? "Guardando…" : "Ya he revisado esta sección"}
                </button>
              </div>
            )}

            {currentStep === "education" && (
              <div className="mt-6 space-y-5">
                <p className="text-sm text-slate-600">
                  Incluye tu formación académica y verifícala. Esta sección refuerza tu candidatura cuando aporta contexto real.
                </p>
                <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700">
                  Si todavía no tienes datos aquí, podrás completarlos más adelante. El perfil seguirá funcionando.
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onContinue("education")}
                  className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving ? "Guardando…" : "Continuar a otros logros"}
                </button>
              </div>
            )}

            {currentStep === "achievements" && (
              <div className="mt-6 space-y-5">
                <p className="text-sm text-slate-600">
                  Añade certificados, premios u otros hitos. Si esta sección no tiene contenido, podrá quedarse al mínimo y ocultarse del perfil público.
                </p>
                <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700">
                  Has llegado al final del onboarding inicial. Después podrás seguir enriqueciendo el perfil desde el dashboard.
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
            )}

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
