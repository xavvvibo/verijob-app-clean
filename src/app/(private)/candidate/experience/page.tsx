import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import CvUploadAndParse from "@/components/candidate/profile/CvUploadAndParse";
import CandidateOperationsLayout from "@/components/candidate-v2/layouts/CandidateOperationsLayout";
import CandidatePageHeader from "@/components/candidate-v2/primitives/CandidatePageHeader";
import CandidateToolbar from "@/components/candidate-v2/primitives/CandidateToolbar";
import CandidateSurface from "@/components/candidate-v2/primitives/CandidateSurface";
import { summarizeCompanyCvImportUpdates } from "@/lib/candidate/import-update-summary";
import { toExperienceVerificationBadgeLabels } from "@/lib/candidate/experience-verification-badges";
import { getCandidatePlanCapabilities } from "@/lib/billing/planCapabilities";
import {
  getExperienceVisibilitySetting,
  readPublicProfileSettings,
  resolveCandidatePublicLimits,
} from "@/lib/candidate/profile-visibility";
import ExperienceQuickAddClient from "./ExperienceQuickAddClient";
import ExperienceListClient from "./ExperienceListClient";
import OnboardingExperienceIdentityBlock from "../../onboarding/experience/OnboardingExperienceIdentityBlock";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function CandidateExperienceContent({
  searchParams,
  onboardingMode = false,
  onboardingEntry,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
  onboardingMode?: boolean;
  onboardingEntry?: "experience";
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();
  if (!au.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, onboarding_completed")
    .eq("id", au.user.id)
    .single();
  if (!profile) redirect("/onboarding");

  const [{ data: rows }, { data: importedRows }, { data: candidateProfile }, { data: employmentRows }, { data: latestSub }] = await Promise.all([
    supabase
      .from("profile_experiences")
      .select("id, role_title, company_name, start_date, end_date, description, matched_verification_id, confidence, created_at")
      .eq("user_id", au.user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("experiences")
      .select("title,company_name,start_date,end_date")
      .eq("user_id", au.user.id),
    supabase
      .from("candidate_profiles")
      .select("raw_cv_json")
      .eq("user_id", au.user.id)
      .maybeSingle(),
    supabase
      .from("employment_records")
      .select("id, source_experience_id, position, company_name_freeform, start_date, end_date, verification_status, last_verification_request_id")
      .eq("candidate_id", au.user.id),
    supabase
      .from("subscriptions")
      .select("plan,created_at")
      .eq("user_id", au.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const publicProfileSettings = readPublicProfileSettings(candidateProfile);
  const candidateCapabilities = getCandidatePlanCapabilities((latestSub as any)?.plan || "free");
  const publicLimits = resolveCandidatePublicLimits((latestSub as any)?.plan || "free");

  const verificationIds = Array.from(
    new Set(
      [...(rows || []).map((x: any) => x.matched_verification_id), ...(employmentRows || []).map((x: any) => x.last_verification_request_id)].filter(Boolean),
    ),
  );
  const verificationMap = new Map<string, {
    status: string | null;
    is_revoked: boolean | null;
    requested_at?: string | null;
    resolved_at?: string | null;
    verification_channel?: string | null;
    request_context?: any;
  }>();
  if (verificationIds.length > 0) {
    const [{ data: linkedRows }, { data: requestRows }] = await Promise.all([
      supabase
      .from("verification_summary")
      .select("verification_id,status,is_revoked")
      .in("verification_id", verificationIds as string[]),
      supabase
      .from("verification_requests")
      .select("id,status,requested_at,resolved_at,verification_channel,request_context")
      .in("id", verificationIds as string[]),
    ]);
    for (const row of linkedRows || []) {
      verificationMap.set((row as any).verification_id, {
        status: (row as any).status ?? null,
        is_revoked: (row as any).is_revoked ?? false,
      });
    }
    for (const row of requestRows || []) {
      const existing = verificationMap.get((row as any).id) || { status: null, is_revoked: false };
      verificationMap.set((row as any).id, {
        ...existing,
        status: (row as any).status ?? existing.status,
        requested_at: (row as any).requested_at ?? null,
        resolved_at: (row as any).resolved_at ?? null,
        verification_channel: (row as any).verification_channel ?? null,
        request_context: (row as any).request_context ?? null,
      });
    }
  }

  function norm(v: any) {
    return String(v || "").trim().toLowerCase();
  }

  function experienceMatchKey(input: any) {
    return [
      norm(input?.role_title ?? input?.position),
      norm(input?.company_name ?? input?.company_name_freeform),
      norm(input?.start_date),
      norm(input?.end_date),
    ].join("|");
  }

  const importedSet = new Set(
    (importedRows || []).map((r: any) => `${norm(r?.title)}|${norm(r?.company_name)}|${norm(r?.start_date)}|${norm(r?.end_date)}`)
  );

  const employmentBySignature = new Map<string, any>();
  const employmentBySourceExperienceId = new Map<string, any>();
  for (const row of employmentRows || []) {
    const key = experienceMatchKey(row);
    if (key && !employmentBySignature.has(key)) {
      employmentBySignature.set(key, row);
    }
    const sourceExperienceId = String((row as any)?.source_experience_id || "").trim();
    if (sourceExperienceId && !employmentBySourceExperienceId.has(sourceExperienceId)) {
      employmentBySourceExperienceId.set(sourceExperienceId, row);
    }
  }

  function resolveLinkedVerification(row: any) {
    const employmentRecord =
      employmentBySourceExperienceId.get(String(row?.id || "").trim()) ||
      employmentBySignature.get(experienceMatchKey(row)) ||
      null;
    const linkedId = String(row?.matched_verification_id || employmentRecord?.last_verification_request_id || "").trim();
    const verification = linkedId ? verificationMap.get(linkedId) || null : null;
    return { employmentRecord, linkedId, verification };
  }

  const normalizedRows = (rows || []).map((r: any) => {
    const linkedEmploymentRecord =
      employmentBySourceExperienceId.get(String(r?.id || "").trim()) ||
      employmentBySignature.get(experienceMatchKey(r)) ||
      null;
    const visibilitySetting = getExperienceVisibilitySetting(publicProfileSettings, {
      profileExperienceId: r?.id || null,
    });
    return {
    id: String(r.id),
    profile_experience_id: String(r.id),
    employment_record_id: String((linkedEmploymentRecord as any)?.id || ""),
    role_title: r.role_title ?? null,
    company_name: r.company_name ?? null,
    start_date: r.start_date ?? null,
    end_date: r.end_date ?? null,
    description: r.description ?? null,
    status: (() => {
      const { employmentRecord, linkedId, verification } = resolveLinkedVerification(r);
      if (!linkedId) return "Sin verificar";
      if (verification?.is_revoked) return "Revocada";
      const status = String(verification?.status || employmentRecord?.verification_status || "").toLowerCase();
      if (status === "verified" || status === "approved" || status === "verified_document") return "Verificada";
      if (status === "revoked") return "Revocada";
      if (status === "reviewing" || status === "in_review") return "En revisión";
      if (status === "rejected") return "Sin verificar";
      return "Verificación solicitada";
    })(),
    last_action: (() => {
      const sig = `${norm(r?.role_title)}|${norm(r?.company_name)}|${norm(r?.start_date)}|${norm(r?.end_date)}`;
      const importedFromCv = importedSet.has(sig);
      const { employmentRecord, linkedId, verification } = resolveLinkedVerification(r);
      if (!linkedId) {
        return importedFromCv
          ? "Importada desde tu CV. Revísala, corrígela si hace falta y luego solicita verificación o sube evidencia."
          : "Sin solicitudes enviadas";
      }
      if (
        toExperienceVerificationBadgeLabels({
          verificationChannel: verification?.verification_channel,
          verificationStatus: verification?.status || employmentRecord?.verification_status,
          requestContext: verification?.request_context,
        }).includes("Vida laboral") &&
        String(employmentRecord?.verification_status || "").trim()
      ) {
        return "Verificada automáticamente por vida laboral.";
      }
      if (!verification) return "Solicitud de verificación enviada";
      if (verification.resolved_at) return `Resuelta: ${verification.resolved_at}`;
      if (verification.requested_at) return `Enviada: ${verification.requested_at}`;
      return "Solicitud en curso";
    })(),
    source_label: (() => {
      const sig = `${norm(r?.role_title)}|${norm(r?.company_name)}|${norm(r?.start_date)}|${norm(r?.end_date)}`;
      const importedFromCv = importedSet.has(sig);
      const { employmentRecord, verification } = resolveLinkedVerification(r);
      const badges = toExperienceVerificationBadgeLabels({
        verificationChannel: verification?.verification_channel,
        verificationStatus: verification?.status || employmentRecord?.verification_status,
        requestContext: verification?.request_context,
      });
      if (badges.includes("Vida laboral")) return "Verificada por documento";
      if (badges.includes("Verificación empresa")) return "Verificada por empresa";
      return importedFromCv ? "Importada desde CV" : null;
    })(),
    verification_labels: (() => {
      const { employmentRecord, verification } = resolveLinkedVerification(r);
      return toExperienceVerificationBadgeLabels({
        verificationChannel: verification?.verification_channel,
        verificationStatus: verification?.status || employmentRecord?.verification_status,
        requestContext: verification?.request_context,
      });
    })(),
    has_exact_profile_request: (() => {
      const { verification } = resolveLinkedVerification(r);
      if (!verification || String(verification?.status || "").toLowerCase() === "rejected") return false;
      const exactProfileExperienceId = String(verification?.request_context?.profile_experience_id || "").trim();
      return exactProfileExperienceId !== "" && exactProfileExperienceId === String(r?.id || "").trim();
    })(),
    public_visibility: {
      visible: visibilitySetting?.visible !== false,
      featured: visibilitySetting?.featured === true,
    },
  };
  });

  const companyCvImportFlag = Array.isArray(resolvedSearchParams?.company_cv_import)
    ? resolvedSearchParams.company_cv_import[0]
    : resolvedSearchParams?.company_cv_import;
  const cvImportFlag = Array.isArray(resolvedSearchParams?.cv_import)
    ? resolvedSearchParams.cv_import[0]
    : resolvedSearchParams?.cv_import;
  const focusFlag = Array.isArray(resolvedSearchParams?.focus)
    ? resolvedSearchParams.focus[0]
    : resolvedSearchParams?.focus;
  const onboardingFlag = Array.isArray(resolvedSearchParams?.onboarding)
    ? resolvedSearchParams.onboarding[0]
    : resolvedSearchParams?.onboarding;
  const importSummary = summarizeCompanyCvImportUpdates((candidateProfile as any)?.raw_cv_json);
  const hasExperiences = normalizedRows.length > 0;
  const hasVerifiedOrInFlight = normalizedRows.some((row) =>
    row.status === "Verificada" || row.status === "En revisión" || row.status === "Verificación solicitada",
  );
  const shouldPushFirstVerification = hasExperiences && !hasVerifiedOrInFlight;
  const profileFullName = String((profile as any)?.full_name || "").trim();
  const confirmedNameParts = profileFullName.split(/\s+/).filter(Boolean);
  const hasConfirmedIdentity = confirmedNameParts.length >= 2;
  const onboardingStage = !hasConfirmedIdentity ? "identity" : !hasExperiences ? "cv" : shouldPushFirstVerification ? "verify" : "continue";

  return (
    <CandidateOperationsLayout>
      <CandidatePageHeader
        eyebrow={onboardingMode ? "Onboarding candidato" : "Experiencia profesional"}
        title={onboardingMode ? "Confirma tu base y revisa tu experiencia" : "Tu trayectoria verificable"}
        description={
          onboardingMode
            ? "Confirma tu nombre, añade experiencia y sigue con la primera validación."
            : "Ordena tu historial, crea tu perfil con claridad y valida primero la experiencia que más confianza puede aportar."
        }
        ctaLabel="Añadir experiencia manual"
        ctaHref={onboardingMode ? "/onboarding/experience?onboarding=1&intent=manual" : "/candidate/experience?new=1#manual-experience"}
        badges={onboardingMode ? ["Dentro del onboarding", "Nombre obligatorio", "Experiencia revisable"] : ["Trayectoria revisable", "Validación por experiencia", "Visibilidad pública controlada"]}
      />
      {onboardingMode ? <OnboardingExperienceIdentityBlock initialFullName={String((profile as any)?.full_name || "").trim() || null} /> : null}
      <div className={onboardingMode ? "mt-6 grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]" : "mt-6"}>
        {onboardingMode ? (
          <aside className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Siguiente paso</p>
            <div className="mt-4 space-y-3">
              {[
                { id: "identity", label: "Confirmar nombre", done: hasConfirmedIdentity, active: onboardingStage === "identity" },
                { id: "cv", label: "Importar o añadir experiencia", done: hasExperiences, active: onboardingStage === "cv" },
                { id: "verify", label: "Solicitar primera verificación", done: hasVerifiedOrInFlight, active: onboardingStage === "verify" },
              ].map((step) => (
                <div key={step.id} className={`rounded-2xl border px-4 py-3 text-sm ${step.active ? "border-slate-900 bg-slate-900 text-white" : step.done ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                  <div className="font-semibold">{step.label}</div>
                  <div className="mt-1 text-xs opacity-80">{step.done ? "Listo" : step.active ? "Ahora" : "Pendiente"}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {onboardingStage === "identity"
                ? "Empieza por guardar nombre y apellidos."
                : onboardingStage === "cv"
                  ? "Ahora importa tu CV o añade una experiencia manual."
                  : onboardingStage === "verify"
                    ? "Tu siguiente paso útil es pedir la primera verificación."
                    : "Ya tienes base suficiente para seguir con el flujo normal."}
            </div>
          </aside>
        ) : null}

        <div className="space-y-6">
      {onboardingMode && !hasConfirmedIdentity ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-5 text-sm text-amber-900 shadow-sm">
          <p className="font-semibold">Antes de importar tu CV o tocar experiencias, guarda nombre y apellidos.</p>
          <p className="mt-2 leading-6 text-amber-800">
            Esta pantalla sigue dentro del onboarding. Hasta que confirmes ese dato mínimo, no puedes continuar al resto del flujo.
          </p>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-amber-700">
            Superficie activa: {onboardingEntry === "experience" ? "onboarding/experience" : "candidate/experience"}
          </p>
        </div>
      ) : null}
      {onboardingMode && hasConfirmedIdentity ? (
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-700 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">
                {hasExperiences ? "Ya tienes base suficiente para seguir." : "Ya puedes pasar a la parte operativa."}
              </p>
              <p className="mt-1 text-slate-600">
                {hasExperiences
                  ? shouldPushFirstVerification
                    ? "Revisa la experiencia más relevante y solicita la primera verificación."
                    : "Continúa revisando tu historial o sigue al flujo normal cuando quieras."
                  : "Importa tu CV o añade una experiencia para completar la base mínima del perfil."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!hasExperiences ? (
                <a href="#cv-upload" className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black">
                  Importar CV
                </a>
              ) : shouldPushFirstVerification ? (
                <a href="#verify-first" className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black">
                  Solicitar verificación
                </a>
              ) : (
                <Link href="/candidate/overview" className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black">
                  Ir al flujo normal
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : null}
      <div className={onboardingMode && !hasConfirmedIdentity ? "pointer-events-none opacity-45" : ""}>
      <CandidateToolbar className="-mt-4">
        <div className="grid w-full gap-3 md:grid-cols-2">
          <Link
            href="#cv-upload"
            className="rounded-2xl border border-blue-200 bg-blue-50/80 px-4 py-4 text-left"
          >
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Importar CV</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">Extraer experiencia desde tu CV</div>
            <div className="mt-1 text-sm text-slate-600">Sube el archivo, revisa lo detectado y corrige antes de validar.</div>
          </Link>
          <Link
            href="#manual-experience"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left"
          >
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Añadir manualmente</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">Crear una experiencia desde cero</div>
            <div className="mt-1 text-sm text-slate-600">Útil cuando falta contexto o quieres dejar una experiencia lista para verificar.</div>
          </Link>
        </div>
      </CandidateToolbar>

      <section className="space-y-8">
        {shouldPushFirstVerification ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-6 py-6 shadow-sm">
            <p className="text-sm font-semibold text-emerald-900">Tu perfil ya está creado.</p>
            <p className="mt-2 text-sm leading-6 text-emerald-800">
              Ahora valida al menos una experiencia para generar confianza real.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href="#verify-first"
                className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
              >
                Verificar mi primera experiencia
              </a>
              <Link
                href={onboardingMode ? "#identity-block" : "/candidate/profile"}
                className="inline-flex rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
              >
                {onboardingMode ? "Revisar nombre y apellidos" : "Completar mi perfil"}
              </Link>
            </div>
          </div>
        ) : null}

        <CandidateSurface id="cv-upload" tone="subtle" className="px-6 py-6">
          <div className="max-w-3xl space-y-2">
            <h2 className="text-lg font-semibold text-slate-950">Importa tu experiencia desde tu CV</h2>
            <p className="text-sm leading-6 text-slate-600">
              Sube tu CV, revisa lo detectado y corrige lo necesario antes de solicitar verificaciones o vincular documentación.
            </p>
          </div>
          {String(cvImportFlag || "") === "1" ? (
            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-900">
              <p className="font-semibold">Tu perfil ya está preparado.</p>
              <p className="mt-1 leading-6 text-blue-800">
                Revisa las experiencias importadas y valida primero la más relevante para que tu perfil genere confianza real.
              </p>
            </div>
          ) : null}
          <div className="mt-4">
            <CvUploadAndParse blocked={onboardingMode && !hasConfirmedIdentity} blockedMessage="Guarda primero nombre y apellidos para activar la importación desde CV." />
          </div>
        </CandidateSurface>

        <div id="manual-experience">
          <ExperienceQuickAddClient />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {String(onboardingFlag || "") === "1" ? (
            <div className="rounded-2xl bg-blue-50/80 px-5 py-5 text-sm text-blue-900">
              <p className="font-semibold">Paso 2 de 4 · Revisa tus experiencias.</p>
              <p className="mt-1 leading-6 text-blue-800">
                Edita o elimina cualquier experiencia antes de avanzar. Si algo no encaja, puedes corregirlo sin afectar al resto.
              </p>
            </div>
          ) : null}

          {String(companyCvImportFlag || "") === "1" ? (
            <div className="rounded-2xl bg-emerald-50/80 px-5 py-5 text-sm text-emerald-900">
              <p className="font-semibold">CV importado desde empresa</p>
              <p className="mt-1 leading-6 text-emerald-800">
                Ya hemos precargado tu historial. Revísalo ahora y decide qué experiencias conviene validar o reforzar.
              </p>
            </div>
          ) : null}
        </div>

        {(importSummary.importedFromCompanyCv || importSummary.updatesCount > 0) ? (
          <div className="rounded-2xl bg-amber-50/90 px-5 py-5 text-sm text-amber-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-2xl">
                <p className="font-semibold">Tienes una actualización pendiente procedente de empresa.</p>
                <p className="mt-1 leading-6 text-amber-800">
                  No se ha aplicado automáticamente. Revísala antes de validar experiencias o solicitar nuevas verificaciones.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-900">
                  Pendientes: {importSummary.totalPendingItems || importSummary.updatesCount}
                </span>
                <Link href="/candidate/import-updates" className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black">
                  Revisar propuesta
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Estado</div>
            <p className="mt-2">Cada experiencia deja claro si está lista, en revisión o si aún necesita validación.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Visibilidad pública</div>
            <p className="mt-2">Tu plan {candidateCapabilities.label} permite mostrar {publicLimits.label} y destacar {publicLimits.featured == null ? "experiencias ilimitadas" : `${publicLimits.featured} experiencia${publicLimits.featured === 1 ? "" : "s"}`}.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Siguiente criterio</div>
            <p className="mt-2">Prioriza primero las experiencias con mejor señal y refuerza después las que siguen siendo declarativas.</p>
          </div>
        </div>

        <ExperienceListClient
          initialRows={normalizedRows as any}
          focusFirstVerifiable={String(focusFlag || "") === "verify-first" || shouldPushFirstVerification}
          publicPlan={{
            work: publicLimits.work,
            featured: publicLimits.featured,
            label: candidateCapabilities.label,
            visibilityLabel: publicLimits.label,
          }}
        />
      </section>
        </div>
      </div>
      </div>
    </CandidateOperationsLayout>
  );
}

export default async function CandidateExperiencePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CandidateExperienceContent searchParams={searchParams} onboardingMode={false} />;
}
