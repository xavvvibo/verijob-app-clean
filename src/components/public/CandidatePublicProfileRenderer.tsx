"use client";

import React, { useEffect, useMemo, useState } from "react";
import ProfileUnlockAction from "@/components/company/ProfileUnlockAction";
import { createClient as createBrowserSupabaseClient } from "@/utils/supabase/client";
import {
  getInitialsFromDisplayName,
  resolvePublicCandidateDisplayName,
  resolvePublicProfileDisplaySummary,
} from "@/lib/public/candidate-profile-display";
import { normalizePublicLanguages } from "@/lib/public/profile-languages";
import { resolvePublicCompanyAccessCta, type PublicCompanyViewerAccess } from "@/lib/public/company-access-cta";
import {
  EMPLOYMENT_RECORD_VERIFICATION_STATUS,
  normalizeEmploymentRecordVerificationStatus,
} from "@/lib/verification/employment-record-verification-status";
import { resolveExperienceTrustPresentation } from "@/lib/candidate/experience-trust";
import {
  getExperienceVerificationBadgeClasses,
  resolveExperienceVerificationBadges,
} from "@/lib/candidate/experience-verification-badges";

export type PublicProfilePreviewMode = "public" | "registered" | "requesting" | "full";

export type PublicCandidateTeaser = {
  full_name?: string | null;
  public_name?: string | null;
  title?: string | null;
  location?: string | null;
  languages?: string[] | null;
  summary?: string | null;
  trust_score?: number | null;
  experiences_total?: number | null;
  verified_experiences?: number | null;
  confirmed_experiences?: number | null;
  evidences_total?: number | null;
  reuse_total?: number | null;
  reuse_companies?: number | null;
  education_total?: number | null;
  achievements_total?: number | null;
  profile_visibility?: string | null;
  lifecycle_status?: string | null;
  availability?: string | null;
  work_mode?: string | null;
  sector?: string | null;
  subscription_plan?: string | null;
  subscription_status?: string | null;
  qr_enabled?: boolean | null;
  cv_download_enabled?: boolean | null;
  latest_verification_at?: string | null;
  featured_verified_experiences?: Array<{
    position?: string | null;
    company_name?: string | null;
    verification_badges?: string[] | null;
  }> | null;
  trust_score_breakdown?: {
    documentary?: number;
    company?: number;
    peer?: number;
    reuse?: number;
    cvConsistency?: number;
  } | null;
  trust_score_components?: {
    documentary?: number;
    company?: number;
    peer?: number;
    reuse?: number;
    cvConsistency?: number;
  } | null;
};

export type PublicCandidateExperience = {
  experience_id?: string | null;
  position?: string | null;
  company_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status_text?: string | null;
  score?: number | null;
  evidence_count?: number | null;
  reuse_count?: number | null;
  company_verification_status_snapshot?: string | null;
  verification_method?: string | null;
  verification_badges?: string[] | null;
  is_verified?: boolean | null;
};

export type PublicCandidateEducation = {
  id?: string | null;
  title?: string | null;
  institution?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  description?: string | null;
};

export type PublicCandidateRecommendation = {
  id?: string | null;
  name?: string | null;
  role?: string | null;
  company?: string | null;
  text?: string | null;
  date?: string | null;
  verified?: boolean | null;
};

export type PublicCandidateContact = {
  email?: string | null;
  phone?: string | null;
};

export type PublicCandidatePayload = {
  teaser?: PublicCandidateTeaser;
  experiences?: PublicCandidateExperience[];
  education?: PublicCandidateEducation[];
  recommendations?: PublicCandidateRecommendation[];
  achievements?: string[];
  verified_skills?: string[];
  token?: string;
};

const modeLabels: Record<PublicProfilePreviewMode, string> = {
  public: "Vista pública",
  registered: "Vista empresa registrada",
  requesting: "Vista empresa solicitante",
  full: "Vista completa",
};

type TabKey = "profile" | "experience" | "education" | "recommendations" | "languages";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "profile", label: "Perfil" },
  { key: "experience", label: "Experiencia" },
  { key: "education", label: "Formación" },
  { key: "recommendations", label: "Recomendaciones" },
  { key: "languages", label: "Idiomas y credenciales" },
];

function getModeCapabilities(mode: PublicProfilePreviewMode) {
  return {
    showTrustScore: mode !== "public",
    showContact: mode === "full",
    maxExperiences: mode === "public" ? 2 : 24,
  };
}

function getTrustStateLabel(args: {
  verifiedExperiences: number;
  inProcessExperiences: number;
  evidences: number;
}) {
  if (args.verifiedExperiences >= 2 || (args.verifiedExperiences >= 1 && args.evidences >= 1)) {
    return "Alta confianza";
  }
  if (args.verifiedExperiences >= 1 || args.inProcessExperiences >= 1 || args.evidences >= 1) {
    return "Confianza media";
  }
  return "Sin validar todavía";
}

function explainTrustState(args: {
  verifiedExperiences: number;
  inProcessExperiences: number;
  evidences: number;
}) {
  if (args.verifiedExperiences > 0 && args.inProcessExperiences > 0) {
    return `${args.verifiedExperiences} ${args.verifiedExperiences === 1 ? "experiencia verificada" : "experiencias verificadas"} · ${args.inProcessExperiences} en proceso`;
  }
  if (args.verifiedExperiences > 0) {
    return `${args.verifiedExperiences} ${args.verifiedExperiences === 1 ? "experiencia verificada" : "experiencias verificadas"}`;
  }
  if (args.inProcessExperiences > 0) {
    return `${args.inProcessExperiences} ${args.inProcessExperiences === 1 ? "verificación en proceso" : "verificaciones en proceso"}`;
  }
  if (args.evidences > 0) {
    return `${args.evidences} ${args.evidences === 1 ? "documento validado" : "documentos validados"}`;
  }
  return "Sin verificaciones todavía";
}

export function CandidatePublicProfileRenderer({
  payload,
  mode = "public",
  companyAccess = true,
  internalPreview = false,
  renderMode = "screen",
  contact,
  companyViewer,
}: {
  payload: PublicCandidatePayload;
  mode?: PublicProfilePreviewMode;
  companyAccess?: boolean;
  internalPreview?: boolean;
  renderMode?: "screen" | "print";
  contact?: PublicCandidateContact;
  companyViewer?: PublicCompanyViewerAccess;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const teaser: PublicCandidateTeaser = useMemo(() => payload?.teaser || {}, [payload]);
  const allExperiences: PublicCandidateExperience[] = useMemo(
    () => (Array.isArray(payload?.experiences) ? payload.experiences : []),
    [payload],
  );
  const education: PublicCandidateEducation[] = Array.isArray(payload?.education) ? payload.education : [];
  const recommendations: PublicCandidateRecommendation[] = Array.isArray(payload?.recommendations)
    ? payload.recommendations
    : [];
  const achievements = Array.isArray(payload?.achievements) ? payload.achievements : [];
  const displaySummary = useMemo(() => resolvePublicProfileDisplaySummary(payload), [payload]);

  const capabilities = getModeCapabilities(mode);
  const experiences = useMemo(() => {
    const rank = (item: PublicCandidateExperience) => {
      const normalized = normalizeEmploymentRecordVerificationStatus(item?.status_text);
      const evidenceCount = Number(item?.evidence_count ?? 0);
      if (normalized === EMPLOYMENT_RECORD_VERIFICATION_STATUS.VERIFIED) return 0;
      if (evidenceCount > 0) return 1;
      if (normalized === EMPLOYMENT_RECORD_VERIFICATION_STATUS.VERIFICATION_REQUESTED) return 2;
      return 3;
    };

    return [...allExperiences]
      .sort((a, b) => {
        const rankDiff = rank(a) - rank(b);
        if (rankDiff !== 0) return rankDiff;
        return Date.parse(String(b?.start_date || 0)) - Date.parse(String(a?.start_date || 0));
      })
      .slice(0, capabilities.maxExperiences);
  }, [allExperiences, capabilities.maxExperiences]);
  const publicLanguages = normalizePublicLanguages(displaySummary.languages);

  const trust = Number(teaser?.trust_score ?? 0);
  const profileVisibility = getProfileVisibilityLabel(teaser?.profile_visibility);

  const token = payload?.token;
  const profileUrl = token
    ? `${typeof window !== "undefined" ? window.location.origin : "https://app.verijob.es"}/p/${token}`
    : null;
  const [resolvedCompanyViewer, setResolvedCompanyViewer] = useState<PublicCompanyViewerAccess>(companyViewer ?? null);
  const [resolvingCompanyViewer, setResolvingCompanyViewer] = useState(false);
  const isPublicCompanyResolutionTarget = mode === "public" && !internalPreview;

  useEffect(() => {
    setResolvedCompanyViewer(companyViewer ?? null);
  }, [companyViewer]);

  useEffect(() => {
    let cancelled = false;

    async function resolveAuthenticatedCompanyViewer() {
      if (!isPublicCompanyResolutionTarget || !companyAccess || !token || companyViewer?.is_authenticated_company) {
        setResolvingCompanyViewer(false);
        return;
      }

      setResolvingCompanyViewer(true);

      try {
        const supabase = createBrowserSupabaseClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (!cancelled) {
            setResolvedCompanyViewer(null);
            setResolvingCompanyViewer(false);
          }
          return;
        }

        const response = await fetch(`/api/company/candidate/${encodeURIComponent(token)}`, {
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          if (!cancelled) {
            setResolvedCompanyViewer(null);
            setResolvingCompanyViewer(false);
          }
          return;
        }

        const accessPayload = await response.json().catch(() => ({}));
        const accessStatus = String(accessPayload?.access?.access_status || "").toLowerCase();

        if (!cancelled) {
          setResolvedCompanyViewer({
            is_authenticated_company: true,
            available_accesses: Number(accessPayload?.gate?.credits_remaining ?? accessPayload?.credits_remaining ?? 0),
            already_unlocked: accessStatus === "active",
            unlocked_at: accessPayload?.access?.access_granted_at ?? null,
            unlocked_until: accessPayload?.access?.access_expires_at ?? null,
          });
          setResolvingCompanyViewer(false);
        }
      } catch {
        if (!cancelled) {
          setResolvedCompanyViewer(null);
          setResolvingCompanyViewer(false);
        }
      }
    }

    void resolveAuthenticatedCompanyViewer();

    return () => {
      cancelled = true;
    };
  }, [companyAccess, companyViewer?.is_authenticated_company, isPublicCompanyResolutionTarget, token]);

  const companyAccessCta = resolvePublicCompanyAccessCta({ token, companyViewer: resolvedCompanyViewer });
  const companyIsAuthenticated = companyAccessCta.companyIsAuthenticated;
  const companyAlreadyUnlocked = Boolean(resolvedCompanyViewer?.already_unlocked);
  const companyAvailableAccesses = Number(resolvedCompanyViewer?.available_accesses ?? 0);
  const qrEnabled = Boolean(teaser?.qr_enabled);
  const cvDownloadEnabled = Boolean(teaser?.cv_download_enabled);
  const qrImageUrl = token && qrEnabled ? `/api/public/candidate/${token}/qr.svg` : null;

  const trustProgress = Math.min(100, Math.max(0, trust));
  const trustRingStyle = {
    background: `conic-gradient(#1d4ed8 ${trustProgress * 3.6}deg, #dbeafe 0deg)`,
  };

  const verificationSummary = useMemo(() => {
    return {
      experiences: Number(teaser?.experiences_total ?? experiences.length),
      verified: Number(teaser?.verified_experiences ?? experiences.filter((e) => Boolean(e.is_verified)).length),
      inProcess: experiences.filter(
        (e) =>
          normalizeEmploymentRecordVerificationStatus(e.status_text) ===
          EMPLOYMENT_RECORD_VERIFICATION_STATUS.VERIFICATION_REQUESTED
      ).length,
      evidences: Number(teaser?.evidences_total ?? 0),
      reuse: Number(teaser?.reuse_total ?? 0),
    };
  }, [teaser, experiences]);
  const trustStateLabel = useMemo(
    () =>
      getTrustStateLabel({
        verifiedExperiences: verificationSummary.verified,
        inProcessExperiences: verificationSummary.inProcess,
        evidences: verificationSummary.evidences,
      }),
    [verificationSummary.evidences, verificationSummary.inProcess, verificationSummary.verified]
  );
  const trustStateExplanation = useMemo(
    () =>
      explainTrustState({
        verifiedExperiences: verificationSummary.verified,
        inProcessExperiences: verificationSummary.inProcess,
        evidences: verificationSummary.evidences,
      }),
    [verificationSummary.evidences, verificationSummary.inProcess, verificationSummary.verified]
  );
  const visibleRecommendations = recommendations.length;
  const profileState = useMemo(
    () =>
      resolveProfilePresentationState({
        verifiedExperiences: verificationSummary.verified,
        evidences: verificationSummary.evidences,
        recommendations: visibleRecommendations,
      }),
    [verificationSummary.verified, verificationSummary.evidences, visibleRecommendations]
  );
  const profileStatus = getProfileStatusLabel(teaser?.lifecycle_status, profileState.statusTitle);

  const trustComponents = useMemo(() => {
    const raw = teaser?.trust_score_components || teaser?.trust_score_breakdown || {};
    const normalized = {
      documentary: clampPercent(Number((raw as any)?.documentary ?? (raw as any)?.evidence ?? 0)),
      company: clampPercent(Number((raw as any)?.company ?? (raw as any)?.verification ?? 0)),
      peer: clampPercent(Number((raw as any)?.peer ?? 0)),
      reuse: clampPercent(Number((raw as any)?.reuse ?? 0)),
      cvConsistency: clampPercent(Number((raw as any)?.cvConsistency ?? (raw as any)?.consistency ?? 0)),
    };
    if (normalized.documentary + normalized.company + normalized.peer + normalized.reuse + normalized.cvConsistency > 0) {
      return normalized;
    }
    const base = Math.max(1, Number(teaser?.experiences_total ?? experiences.length));
    return {
      documentary: clampPercent((Number(teaser?.evidences_total ?? 0) / Math.max(1, base * 2)) * 100),
      company: clampPercent((Number(teaser?.verified_experiences ?? 0) / base) * 100),
      peer: 0,
      cvConsistency: clampPercent(
        ((Number(Boolean(teaser?.title)) + Number(Boolean(teaser?.summary)) + Number(publicLanguages.length > 0)) / 3) * 100
      ),
      reuse: clampPercent((Number(teaser?.reuse_total ?? 0) / base) * 100),
    };
  }, [teaser, experiences.length, publicLanguages.length]);

  const isExternalCleanView = !internalPreview;
  const isPrintMode = renderMode === "print";
  const isOpenPublicView = isPublicCompanyResolutionTarget;
  const displayName = resolvePublicCandidateDisplayName(payload);
  const trustHeadline = `${Math.round(trust)} · ${trustStateLabel}`;
  const hasSecondarySummary = Boolean((qrEnabled || internalPreview) || capabilities.showContact || companyAccess);
  const hasExperiences = experiences.length > 0;
  const hasEducation = displaySummary.educationCount > 0;
  const hasRecommendations = recommendations.length > 0;
  const hasLanguages = publicLanguages.length > 0;
  const hasAchievements = displaySummary.achievementsCount > 0;
  const hasSkills = displaySummary.skills.length > 0;
  const featuredVerifiedExperiences = Array.isArray(teaser?.featured_verified_experiences)
    ? teaser.featured_verified_experiences
    : [];
  const hasProfileCore =
    Boolean(teaser?.summary || teaser?.title || teaser?.location || teaser?.sector || teaser?.work_mode || teaser?.availability) ||
    verificationSummary.experiences > 0 ||
    hasSkills;

  const visibleTabs = useMemo(() => {
    if (isOpenPublicView) return [{ key: "profile" as TabKey, label: "Perfil" }];
    if (!isExternalCleanView) return tabs;
    const out: Array<{ key: TabKey; label: string }> = [];
    if (hasProfileCore) out.push({ key: "profile", label: "Perfil" });
    if (hasExperiences) out.push({ key: "experience", label: "Experiencia" });
    if (hasEducation) out.push({ key: "education", label: "Formación" });
    if (hasRecommendations) out.push({ key: "recommendations", label: "Recomendaciones" });
    if (hasLanguages || hasAchievements) out.push({ key: "languages", label: "Idiomas y credenciales" });
    return out.length ? out : [{ key: "profile", label: "Perfil" }];
  }, [isOpenPublicView, isExternalCleanView, hasProfileCore, hasExperiences, hasEducation, hasRecommendations, hasLanguages, hasAchievements]);

  useEffect(() => {
    if (!visibleTabs.some((x) => x.key === activeTab)) {
      setActiveTab((visibleTabs[0]?.key as TabKey) ?? "profile");
    }
  }, [activeTab, visibleTabs]);

  const completionHints = useMemo(() => {
    if (!internalPreview) return [];
    const hints: string[] = [];
    if (!teaser?.title) hints.push("Añade tu titular profesional para reforzar la primera impresión.");
    if (!hasLanguages) hints.push("Añade idiomas para mejorar tu perfil compartible.");
    if (!hasEducation) hints.push("Añade formación para que aparezca en tu CV verificable.");
    if (!hasAchievements) hints.push("Añade logros o certificaciones para reforzar tu credibilidad.");
    return hints;
  }, [internalPreview, teaser?.title, hasLanguages, hasEducation, hasAchievements]);

  const showProfileTab = isPrintMode || activeTab === "profile";
  const showExperienceTab = (!isOpenPublicView && isPrintMode) || activeTab === "experience";
  const showEducationTab = (!isOpenPublicView && isPrintMode) || activeTab === "education";
  const showRecommendationsTab = (!isOpenPublicView && isPrintMode) || activeTab === "recommendations";
  const showLanguagesTab = (!isOpenPublicView && isPrintMode) || activeTab === "languages";

  if (isOpenPublicView) {
    return (
      <section className="rounded-[32px] border border-slate-200 bg-white/90 p-4 shadow-sm sm:p-5">
        <div className="space-y-5">
          <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/brand/verijob-logo-white-bg.png" alt="Verijob" className="h-6 w-auto object-contain" />
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Vista pública</span>
                </div>
                <h1 className="mt-2 text-3xl font-semibold text-slate-900">{displayName}</h1>
                <p className="mt-1 text-sm font-medium text-blue-800">
                  {[teaser?.title, teaser?.sector].filter(Boolean).join(" · ") || "Credencial laboral verificable"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                  {teaser?.location ? <Pill>{teaser.location}</Pill> : null}
                  <Pill>{verificationSummary.verified} verificaciones</Pill>
                  <Pill>Nivel de confianza {Math.round(trust)}</Pill>
                  <Pill>{displaySummary.educationLabel}</Pill>
                  <Pill>{displaySummary.languagesLabel}</Pill>
                  <Pill>{displaySummary.capabilitiesLabel}</Pill>
                </div>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-right">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-900">Perfil resumido</div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">{Math.round(trust)}</div>
                <div className="text-sm text-slate-700">{trustStateLabel}</div>
              </div>
            </div>

            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-700">
              No es solo un CV visible: es un perfil con señales reales para generar confianza más rápido.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              {companyIsAuthenticated && token ? (
                <>
                  <ProfileUnlockAction
                    candidateToken={token}
                    href={companyAccessCta.companyFullHref}
                    requestHref={companyAccessCta.companyUnlockHref}
                    availableAccesses={companyAvailableAccesses}
                    alreadyUnlocked={companyAlreadyUnlocked}
                    unlockedAt={resolvedCompanyViewer?.unlocked_at ?? null}
                    unlockedUntil={resolvedCompanyViewer?.unlocked_until ?? null}
                    primaryLabel="Ver perfil completo (-1 acceso)"
                    upgradeHref="/company/subscription"
                  />
                  <a
                    href={companyAccessCta.companyPreviewHref}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Ver resumen empresa
                  </a>
                </>
              ) : resolvingCompanyViewer ? (
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-500"
                >
                  Comprobando acceso empresa…
                </button>
              ) : (
                <>
                  <a
                    href={companyAccessCta.signupUrl}
                    className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                  >
                    Acceso empresa
                  </a>
                  <a
                    href={companyAccessCta.loginUrl}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Ya tengo cuenta empresa
                  </a>
                </>
              )}
            </div>
            {companyIsAuthenticated ? (
              <p className="mt-3 text-xs text-slate-500">
                {companyAlreadyUnlocked
                  ? "Tu empresa ya tiene este perfil desbloqueado y puede abrir la vista completa sin consumir otro acceso dentro de la ventana activa."
                  : companyAvailableAccesses > 0
                    ? `Tu empresa tiene ${companyAvailableAccesses} acceso${companyAvailableAccesses === 1 ? "" : "s"} disponible${companyAvailableAccesses === 1 ? "" : "s"} para abrir perfiles completos.`
                    : "Tu empresa no tiene accesos disponibles ahora mismo. Puedes seguir viendo este resumen o activar más accesos cuando lo necesites."}
              </p>
            ) : (
              <p className="mt-3 text-xs text-slate-500">Regístrate para evaluar perfiles con más contexto y señal verificable.</p>
            )}
          </header>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SignalCard label="Nivel de confianza" value={Math.round(trust)} hint="Resume qué parte de la trayectoria ya está respaldada por señales verificables." />
            <SignalCard label="Experiencias verificadas" value={verificationSummary.verified} hint="Trayectoria contrastada" />
            <SignalCard label="Experiencias visibles" value={experiences.length} hint="Vista pública resumida" />
            <SignalCard
              label="Formación"
              value={displaySummary.educationCount || "Formacion pendiente"}
              hint="Base académica visible"
            />
            <SignalCard
              label="Idiomas y logros"
              value={publicLanguages.length ? displaySummary.languagesLabel : displaySummary.capabilitiesLabel}
              hint="Señal complementaria del perfil"
            />
          </div>
          <p className="text-sm text-slate-600">Cuantas más señales verificadas, menos dudas para quien evalúa.</p>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Trayectoria visible</h2>
                <p className="mt-1 text-sm text-slate-600">Lo que el candidato declara y decide compartir.</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                Sin datos de contacto
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {experiences.length ? (
                experiences.map((exp, index) => {
                  const verificationBadges = resolveExperienceVerificationBadges({
                    verificationBadges: exp?.verification_badges,
                    verificationChannel: exp?.verification_method,
                    verificationStatus: exp?.status_text,
                    companyVerificationStatusSnapshot: exp?.company_verification_status_snapshot,
                    evidenceCount: exp?.evidence_count,
                  });
                  const primaryVerificationBadge = verificationBadges[0] || null;
                  return (
                    <article key={String(exp?.experience_id || `public-exp-${index}`)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-slate-900">{exp?.position || "Experiencia profesional"}</h3>
                          <p className="text-sm text-slate-600">{exp?.company_name || "Empresa verificada"}</p>
                        </div>
                        {primaryVerificationBadge ? (
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getExperienceVerificationBadgeClasses(primaryVerificationBadge.tone, "primary")}`}>
                            {primaryVerificationBadge.label}
                          </span>
                        ) : null}
                      </div>
                    </article>
                  );
                })
              ) : (
                <Empty text="Todavía no hay experiencias públicas visibles." />
              )}
            </div>
          </section>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[32px] border border-slate-200 bg-white/75 p-3 shadow-sm print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none sm:p-4 lg:p-5">
      <div className="space-y-5">
        <header className={`${isPrintMode ? "static" : "relative"} rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-lg backdrop-blur print:static print:top-auto print:rounded-none print:border-0 print:p-0 print:shadow-none sm:p-7`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-xl font-bold text-white shadow-sm">
                  {getInitialsFromDisplayName(displayName)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/brand/verijob-logo-white-bg.png"
                      alt="Verijob"
                      className="h-6 w-auto object-contain"
                    />
                    {!isPrintMode ? (
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {modeLabels[mode]}
                      </div>
                    ) : null}
                  </div>
                  <h1 className="mt-1 whitespace-normal break-words text-2xl font-semibold text-slate-900 sm:text-3xl">
                    {displayName}
                  </h1>
                  {teaser?.title || internalPreview ? (
                    <p className="mt-1 text-sm font-medium text-blue-800">{teaser?.title || "Añade tu titular profesional"}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-600">
                    Perfil profesional verificable pensado para generar confianza desde la primera revisión.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                    {teaser?.location ? <Pill>{teaser.location}</Pill> : null}
                    {!isOpenPublicView && teaser?.sector ? <Pill>{teaser.sector}</Pill> : null}
                    {!isOpenPublicView && teaser?.work_mode ? <Pill>{teaser.work_mode}</Pill> : null}
                    {teaser?.availability ? <Pill>{teaser.availability}</Pill> : null}
                    <Pill>{profileVisibility}</Pill>
                    <Pill>{profileStatus}</Pill>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {isOpenPublicView && !isPrintMode ? (
                  <>
                    <a
                      href={companyAccessCta.signupUrl}
                      className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                    >
                      Registro
                    </a>
                    <a
                      href="/para-empresas"
                      className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Ventajas
                    </a>
                  </>
                ) : null}
                {!isOpenPublicView && !isPrintMode ? (
                  <>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!profileUrl) return;
                        try {
                          await navigator.clipboard.writeText(profileUrl);
                          setShareMessage("Enlace copiado al portapapeles.");
                        } catch {
                          setShareMessage("No se pudo copiar automáticamente. Copia la URL desde el navegador.");
                        }
                      }}
                      className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                    >
                      Compartir perfil verificable
                    </button>
                    {token && cvDownloadEnabled ? (
                      <a
                        href={`/p/${encodeURIComponent(token)}?print=1`}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Descargar CV (PDF)
                      </a>
                    ) : null}
                    <a
                      href={companyAccessCta.loginUrl}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Vista empresa
                    </a>
                  </>
                ) : null}
              </div>
            </div>
            {shareMessage ? (
              <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800">
                {shareMessage}
              </div>
            ) : null}

            {!isOpenPublicView ? (
              <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-700">
                {teaser?.summary ||
                  "Perfil profesional verificable con historial laboral estructurado, señales de confianza y validación por empresa/documentación sin exponer archivos privados."}
              </p>
            ) : (
              <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-700">
                Resumen profesional público con señales de confianza y trayectoria visible, sin exponer el perfil completo.
              </p>
            )}

            <div className={`mt-4 ${isOpenPublicView ? "rounded-2xl border border-blue-100 bg-blue-50/70 p-4" : "grid gap-2 sm:grid-cols-2 xl:grid-cols-4"}`}>
              {isOpenPublicView ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-900">Nivel de confianza</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{trustHeadline}</p>
                    <p className="mt-1 text-sm text-slate-700">Resume qué parte de la trayectoria ya está respaldada por señales verificables.</p>
                    <p className="mt-2 text-xs leading-5 text-slate-600">Cuantas más señales verificadas, menos dudas para quien evalúa.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      {verificationSummary.verified} verificadas
                    </span>
                    <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      {verificationSummary.inProcess} en proceso
                    </span>
                    <span className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      {verificationSummary.evidences} con soporte documental
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <SignalCard
                    label="Verificaciones"
                    value={verificationSummary.verified}
                    hint="Experiencias contrastadas"
                  />
                  <SignalCard
                    label="En proceso"
                    value={verificationSummary.inProcess}
                    hint="Validaciones en marcha"
                  />
                  <SignalCard
                    label="Evidencias"
                    value={verificationSummary.evidences}
                    hint="Soporte documental validado"
                  />
                  <SignalCard
                    label="Uso empresarial"
                    value={verificationSummary.reuse}
                    hint="Actividad empresarial registrada"
                  />
                  <SignalCard
                    label="Nivel de confianza"
                    value={trustStateLabel}
                    hint={trustStateExplanation}
                  />
                </>
              )}
            </div>

            {!isPrintMode ? (
            <div className="mt-5 flex flex-wrap gap-2 print:hidden">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key as TabKey)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    activeTab === tab.key
                      ? "border-blue-200 bg-blue-50 text-blue-800"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            ) : null}
        </header>

        {!isPrintMode && !isOpenPublicView ? (
          <div className={`grid gap-5 ${hasSecondarySummary ? "xl:grid-cols-[minmax(0,1fr)_320px]" : "grid-cols-1"}`}>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Resumen ejecutivo</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Señales clave para decisión empresarial, sin comprimir el contenido principal del perfil.
                  </p>
                </div>
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                  {profileState.statusTitle}
                </span>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
                <div className="rounded-3xl border border-blue-100 bg-blue-50/75 p-5">
                  <div className="flex items-center justify-center">
                    <div className="relative h-28 w-28 rounded-full p-1.5" style={trustRingStyle}>
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-white px-3 text-center text-sm font-semibold text-slate-900">
                        {trustStateLabel}
                      </div>
                    </div>
                  </div>
                  <p className="mt-4 text-center text-sm font-semibold text-slate-900">
                    {trustStateLabel}
                  </p>
                  <p className="mt-2 text-center text-xs leading-5 text-slate-600">
                    {trustStateExplanation}
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricChip label="Experiencias verificadas" value={verificationSummary.verified} />
                    <MetricChip label="Verificaciones empresariales" value={Number(teaser?.confirmed_experiences ?? 0)} />
                    <MetricChip label="Docs validados" value={verificationSummary.evidences} />
                    <MetricChip label="Recomendaciones" value={recommendations.length} />
                  </div>
                  {!isOpenPublicView ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Qué refuerza este perfil</div>
                      <div className="mt-3 space-y-2">
                        <TrustBreakdownBar label="Documental" value={trustComponents.documentary} />
                        <TrustBreakdownBar label="Empresa" value={trustComponents.company} />
                        <TrustBreakdownBar label="Peer" value={trustComponents.peer} />
                        <TrustBreakdownBar label="Reuse" value={trustComponents.reuse} />
                        <TrustBreakdownBar label="Consistencia CV" value={trustComponents.cvConsistency} />
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-500">
                        Este nivel de confianza resume señales verificables del perfil. Ayuda a decidir más rápido, pero no sustituye la revisión humana.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-sm text-slate-700">
                      <p className="font-semibold text-slate-900">Señales verificadas</p>
                      <ul className="mt-2 space-y-1.5 text-xs leading-5">
                        <li>{trustStateExplanation}</li>
                        <li>Verificaciones empresariales: {Number(teaser?.confirmed_experiences ?? 0)}</li>
                        <li>Documentos laborales validados: {verificationSummary.evidences}</li>
                        <li>Trayectoria mostrada en formato resumido y verificable.</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {hasSecondarySummary ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                {(qrEnabled || internalPreview) ? (
                  <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-900">QR del perfil verificado</h3>
                    {qrEnabled && qrImageUrl ? (
                      <>
                        <p className="mt-2 text-xs leading-5 text-slate-600">Escanea para abrir este perfil verificable.</p>
                        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={qrImageUrl}
                            alt="QR del perfil verificado"
                            className="mx-auto h-auto w-full max-w-[180px] rounded-lg object-contain"
                          />
                        </div>
                      </>
                    ) : (
                      <Empty text="Disponible con planes que habilitan QR público del perfil." compact />
                    )}
                  </section>
                ) : null}

                {capabilities.showContact ? (
                  <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-900">Contacto visible</h3>
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      <p>Email: <span className="font-medium text-slate-900">{contact?.email || "No compartido"}</span></p>
                      <p>Teléfono: <span className="font-medium text-slate-900">{contact?.phone || "No compartido"}</span></p>
                    </div>
                  </section>
                ) : null}

                {companyAccess ? (
                  <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-900">{isOpenPublicView ? "Acceso para empresas" : "Acceso empresa"}</h3>
                    <p className="mt-2 text-xs leading-5 text-slate-600">
                      {isOpenPublicView
                        ? "Accede a más contexto profesional y señales completas para decidir mejor."
                        : "Para acceder a más contexto operativo, utiliza la vista de empresa."}
                    </p>
                    <div className="mt-4 space-y-2">
                      {isOpenPublicView && companyIsAuthenticated && token ? (
                        <>
                          <ProfileUnlockAction
                            candidateToken={token}
                            href={companyAccessCta.companyFullHref}
                            requestHref={companyAccessCta.companyUnlockHref}
                            availableAccesses={companyAvailableAccesses}
                            alreadyUnlocked={companyAlreadyUnlocked}
                            unlockedAt={resolvedCompanyViewer?.unlocked_at ?? null}
                            unlockedUntil={resolvedCompanyViewer?.unlocked_until ?? null}
                            primaryLabel="Ver perfil completo (-1 acceso)"
                            upgradeHref="/company/subscription"
                          />
                          <a
                            className="inline-flex w-full justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                            href={companyAccessCta.companyPreviewHref}
                          >
                            Ver resumen empresa
                          </a>
                        </>
                      ) : resolvingCompanyViewer && isOpenPublicView ? (
                        <button
                          type="button"
                          disabled
                          className="inline-flex w-full justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-500"
                        >
                          Comprobando acceso empresa…
                        </button>
                      ) : (
                        <>
                          <a className="inline-flex w-full justify-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800" href={companyAccessCta.signupUrl}>
                            {isOpenPublicView ? "Registro" : "Crear cuenta empresa"}
                          </a>
                          <a
                            className="inline-flex w-full justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                            href={isOpenPublicView ? "/para-empresas" : companyAccessCta.loginUrl}
                          >
                            {isOpenPublicView ? "Ventajas" : "Iniciar sesión empresa"}
                          </a>
                        </>
                      )}
                    </div>
                  </section>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <main className="space-y-4">
            {isPrintMode ? (
                <Card title="Confianza y verificación" subtitle="Resumen público de credibilidad y verificación del perfil.">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <SummaryInfo label="Nivel de confianza" value={trustStateLabel} />
                  <Stat label="Experiencias verificadas" value={verificationSummary.verified} />
                  <Stat label="En proceso" value={verificationSummary.inProcess} />
                  <Stat label="Evidencias validadas" value={verificationSummary.evidences} />
                </div>
              </Card>
            ) : null}

            {showProfileTab ? (
              <>
                <Card
                    title={isOpenPublicView ? "Señales públicas de verificación" : "Identidad y señales de confianza"}
                  subtitle={
                    isOpenPublicView
                      ? "Vista pública resumida con señales de confianza y trayectoria profesional protegida."
                      : "Lectura inicial del perfil para entender rápido quién es la persona y por qué transmite más o menos confianza."
                  }
                >
                    <div className="space-y-4">
                      <p className="max-w-4xl text-sm leading-6 text-slate-700">
                        {teaser?.summary ||
                          (isOpenPublicView
                            ? "Resumen profesional pensado para que una empresa entienda rápido la trayectoria y las señales de confianza, sin exponer el perfil completo."
                            : "Resumen profesional priorizado para compartir un perfil verificable claro, legible y centrado en la trayectoria real del candidato.")}
                      </p>
                    <div className={`grid gap-3 sm:grid-cols-2 ${isOpenPublicView ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
                      <SummaryInfo label="Experiencias visibles" value={String(verificationSummary.experiences)} />
                      <SummaryInfo
                        label="Formación visible"
                        value={
                          displaySummary.educationCount > 0
                            ? String(displaySummary.educationCount)
                            : "Formacion pendiente"
                        }
                      />
                      <SummaryInfo
                        label="Idiomas"
                        value={displaySummary.languagesLabel}
                      />
                      {isOpenPublicView ? (
                        <SummaryInfo
                          label="Habilidades y logros"
                          value={displaySummary.capabilitiesLabel}
                        />
                      ) : null}
                      <SummaryInfo label="Estado de confianza" value={isOpenPublicView ? "Perfil con validaciones reales" : trustStateLabel} />
                    </div>
                    {!isOpenPublicView && featuredVerifiedExperiences.length ? (
                      <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-blue-900">Experiencias confirmadas destacadas</div>
                        <ul className="mt-2 space-y-2">
                          {featuredVerifiedExperiences.map((item, idx) => (
                            <li key={`${item.position || "exp"}-${idx}`} className="rounded-xl border border-white/80 bg-white px-3 py-2">
                              {(() => {
                                const badges = resolveExperienceVerificationBadges({
                                  verificationBadges: item.verification_badges,
                                });
                                const primary = badges[0] || null;
                                const secondary = badges.slice(1, 2);
                                return (
                                  <>
                              <div className="text-sm font-semibold text-slate-900">{item.position || "Experiencia verificada"}</div>
                              {item.company_name ? <div className="text-xs text-slate-600">{item.company_name}</div> : null}
                              {primary ? (
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getExperienceVerificationBadgeClasses(primary.tone, "primary")}`}>
                                    {primary.label}
                                  </span>
                                  {secondary.map((badge) => (
                                    <span key={`${item.position || idx}-${badge.key}`} className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getExperienceVerificationBadgeClasses(badge.tone)}`}>
                                      {badge.label}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                                  </>
                                );
                              })()}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </Card>

                {isOpenPublicView ? (
                  <Card
                    title="Trayectoria visible"
                    subtitle="Lo que el candidato declara y decide compartir."
                  >
                    {experiences.length ? (
                      <div className="space-y-3">
                        {experiences.map((exp, index) => {
                          const statusBadge = getStatusBadge(exp?.status_text);
                          const trustPresentation = resolveExperienceTrustPresentation({
                            rawStatus: exp?.status_text,
                            evidenceCount: Number(exp?.evidence_count ?? 0),
                          });
                          const verificationBadges = resolveExperienceVerificationBadges({
                            verificationBadges: exp?.verification_badges,
                            verificationChannel: exp?.verification_method,
                            verificationStatus: exp?.status_text,
                            companyVerificationStatusSnapshot: exp?.company_verification_status_snapshot,
                            evidenceCount: exp?.evidence_count,
                          });
                          const primaryVerificationBadge = verificationBadges[0] || null;
                          const secondaryVerificationBadges = verificationBadges.slice(1, 3);
                          return (
                            <article
                              key={String(exp?.experience_id || `public-exp-${index}`)}
                              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <h4 className="text-base font-semibold text-slate-900">{exp?.position || "Experiencia"}</h4>
                                  <p className="text-sm text-slate-600">{exp?.company_name || "Empresa"}</p>
                                  <p className="mt-1 text-xs text-slate-500">{formatPeriod(exp?.start_date, exp?.end_date)}</p>
                                </div>
                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadge.className}`}>
                                  {statusBadge.label}
                                </span>
                              </div>
                              <p className="mt-3 text-sm text-slate-700">{trustPresentation.explanation}</p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {primaryVerificationBadge ? (
                                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getExperienceVerificationBadgeClasses(primaryVerificationBadge.tone, "primary")}`}>
                                    {primaryVerificationBadge.label}
                                  </span>
                                ) : null}
                                {secondaryVerificationBadges.map((badge) => (
                                  <span key={`${exp?.experience_id}-${badge.key}`} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getExperienceVerificationBadgeClasses(badge.tone)}`}>
                                    {badge.label}
                                  </span>
                                ))}
                                {trustPresentation.support_label ? (
                                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
                                    {trustPresentation.support_label}
                                  </span>
                                ) : null}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <Empty text="Todavía no hay experiencias públicas destacadas." />
                    )}
                  </Card>
                ) : null}

                {(!isOpenPublicView && (experiences.length > 0 || internalPreview)) ? (
                  <Card
                    title="Señales verificadas"
                    subtitle="Lo que ya cuenta con validación o soporte real, sin exponer documentación sensible."
                  >
                    {experiences.length ? (
                      <ol className="relative ml-2 border-l border-slate-200 pl-4">
                        {experiences.slice(0, 10).map((exp, index) => {
                          const statusBadge = getStatusBadge(exp?.status_text);
                          const trustPresentation = resolveExperienceTrustPresentation({
                            rawStatus: exp?.status_text,
                            evidenceCount: Number(exp?.evidence_count ?? 0),
                          });
                          const verificationBadges = resolveExperienceVerificationBadges({
                            verificationBadges: exp?.verification_badges,
                            verificationChannel: exp?.verification_method,
                            verificationStatus: exp?.status_text,
                            companyVerificationStatusSnapshot: exp?.company_verification_status_snapshot,
                            evidenceCount: exp?.evidence_count,
                          });
                          const primaryVerificationBadge = verificationBadges[0] || null;
                          const secondaryVerificationBadges = verificationBadges.slice(1, 3);
                          return (
                            <li key={`timeline-${exp?.experience_id || index}`} className="mb-5 last:mb-0" style={{ breakInside: "avoid" }}>
                              <span className="absolute -left-[6px] mt-1.5 h-2.5 w-2.5 rounded-full bg-blue-600" />
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">{exp?.position || "Experiencia"}</p>
                                    <p className="text-xs text-slate-600">{exp?.company_name || "Empresa"}</p>
                                    <p className="mt-1 text-[11px] text-slate-500">{formatPeriod(exp?.start_date, exp?.end_date)}</p>
                                  </div>
                                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadge.className}`}>
                                    {statusBadge.label}
                                  </span>
                                </div>
                                <p className="mt-2 text-xs text-slate-600">{trustPresentation.explanation}</p>
                                {primaryVerificationBadge ? (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getExperienceVerificationBadgeClasses(primaryVerificationBadge.tone, "primary")}`}>
                                      {primaryVerificationBadge.label}
                                    </span>
                                    {secondaryVerificationBadges.map((badge) => (
                                      <span key={`${exp?.experience_id}-${badge.key}`} className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getExperienceVerificationBadgeClasses(badge.tone)}`}>
                                        {badge.label}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                                {trustPresentation.support_label ? (
                                  <div className="mt-2">
                                    <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                                      {trustPresentation.support_label}
                                    </span>
                                  </div>
                                ) : null}
                                <div className="mt-2 text-[11px] text-slate-600">
                                  Señales documentales: <span className="font-semibold text-slate-900">{Number(exp?.evidence_count ?? 0)}</span>
                                  {!isOpenPublicView ? (
                                    <>
                                      {" · "}
                                      Uso empresarial: <span className="font-semibold text-slate-900">{Number(exp?.reuse_count ?? 0)}</span>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    ) : (
                      <Empty text="Sin historial verificable visible por ahora." />
                    )}
                  </Card>
                ) : null}

                {(displaySummary.skills.length > 0 || internalPreview) ? (
                  <Card title="Habilidades clave" subtitle="Competencias destacadas que refuerzan la lectura laboral del perfil.">
                    {displaySummary.skills.length ? (
                      <div className="flex flex-wrap gap-2">
                        {displaySummary.skills.map((skill) => (
                          <span key={skill} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <Empty text="Habilidades aun no visibles." />
                    )}
                  </Card>
                ) : null}

                {!isOpenPublicView ? (
                <Card title="Datos clave" subtitle="Solo datos públicos y relevantes para evaluación profesional.">
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    {teaser?.location || internalPreview ? (
                      <Item label="Ubicación" value={teaser?.location || "Añade ubicación"} />
                    ) : null}
                    {teaser?.title || internalPreview ? (
                      <Item label="Título profesional" value={teaser?.title || "Añade titular"} />
                    ) : null}
                    {!isOpenPublicView && (publicLanguages.length || internalPreview) ? (
                      <Item label="Idiomas" value={publicLanguages.length ? publicLanguages.join(", ") : "Idiomas no añadidos"} />
                    ) : null}
                    {teaser?.availability ? <Item label="Disponibilidad" value={String(teaser.availability)} /> : null}
                    <Item label="Estado de perfil" value={profileStatus} />
                  </dl>
                </Card>
                ) : null}

                {completionHints.length ? (
                  <Card title="Sugerencias de completado" subtitle="Solo visible en tu preview interna.">
                    <ul className="space-y-2">
                      {completionHints.map((hint) => (
                        <li key={hint} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                          {hint}
                        </li>
                      ))}
                    </ul>
                  </Card>
                ) : null}
              </>
            ) : null}

            {showExperienceTab ? (
              <Card title="Experiencia profesional" subtitle="Historial en formato verificable con badges de validación (sin documentos privados).">
                {experiences.length ? (
                  <div className="space-y-3">
                    {experiences.map((exp, index) => {
                      const statusBadge = getStatusBadge(exp?.status_text);
                      const trustPresentation = resolveExperienceTrustPresentation({
                        rawStatus: exp?.status_text,
                        evidenceCount: Number(exp?.evidence_count ?? 0),
                      });
                      const companyStatusBadge = getCompanyStatusBadge(exp?.company_verification_status_snapshot);
                      const verificationBadges = resolveExperienceVerificationBadges({
                        verificationBadges: exp?.verification_badges,
                        verificationChannel: exp?.verification_method,
                        verificationStatus: exp?.status_text,
                        companyVerificationStatusSnapshot: exp?.company_verification_status_snapshot,
                        evidenceCount: exp?.evidence_count,
                      });
                      const primaryVerificationBadge = verificationBadges[0] || null;
                      const secondaryVerificationBadges = verificationBadges.slice(1, 3);
                      return (
                        <article
                          key={String(exp?.experience_id || `exp-${index}`)}
                          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                          style={{ breakInside: "avoid" }}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h4 className="text-base font-semibold text-slate-900">{exp?.position || "Experiencia"}</h4>
                              <p className="text-sm text-slate-600">{exp?.company_name || "Empresa"}</p>
                              <p className="mt-1 text-xs text-slate-500">{formatPeriod(exp?.start_date, exp?.end_date)}</p>
                            </div>
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadge.className}`}>
                              {statusBadge.label}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {primaryVerificationBadge ? (
                              <span
                                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getExperienceVerificationBadgeClasses(primaryVerificationBadge.tone, "primary")}`}
                              >
                                {primaryVerificationBadge.label}
                              </span>
                            ) : null}
                            {secondaryVerificationBadges.map((badge) => (
                              <span
                                key={`${exp?.experience_id || index}-${badge.key}`}
                                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getExperienceVerificationBadgeClasses(badge.tone)}`}
                              >
                                {badge.label}
                              </span>
                            ))}
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${companyStatusBadge.className}`}>
                              {companyStatusBadge.label}
                            </span>
                            {trustPresentation.support_label ? (
                              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
                                {trustPresentation.support_label}
                              </span>
                            ) : null}
                          </div>

                          <p className="mt-3 text-sm text-slate-700">{trustPresentation.explanation}</p>

                          <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                            <div>Confianza: <span className="font-semibold text-slate-900">{statusBadge.label}</span></div>
                            <div>Señales documentales: <span className="font-semibold text-slate-900">{Number(exp?.evidence_count ?? 0)}</span></div>
                            {!isOpenPublicView ? (
                              <div>Uso empresarial: <span className="font-semibold text-slate-900">{Number(exp?.reuse_count ?? 0)}</span></div>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : internalPreview ? (
                  <Empty text="No hay experiencias visibles en este perfil público." />
                ) : null}
              </Card>
            ) : null}

            {showEducationTab ? (
              <Card title="Formación" subtitle="Trayectoria académica visible del candidato.">
                {education.length ? (
                  <div className="space-y-3">
                    {education.map((item, idx) => (
                      <article key={String(item.id || `edu-${idx}`)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" style={{ breakInside: "avoid" }}>
                        <h4 className="text-base font-semibold text-slate-900">{item.title || "Formación"}</h4>
                        <p className="text-sm text-slate-600">{item.institution || "Centro no indicado"}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatPeriod(item.start_date, item.end_date)}</p>
                        {item.description ? <p className="mt-2 text-sm text-slate-700">{item.description}</p> : null}
                        <div className="mt-3 inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
                          Formación validada en perfil
                        </div>
                      </article>
                    ))}
                  </div>
                ) : internalPreview ? (
                  <Empty text="Formacion pendiente." />
                ) : null}
              </Card>
            ) : null}

            {showRecommendationsTab ? (
              <Card title="Recomendaciones" subtitle="Validaciones profesionales visibles en el perfil público.">
                {recommendations.length ? (
                  <div className="space-y-3">
                    {recommendations.map((recommendation, idx) => (
                      <article key={String(recommendation.id || `rec-${idx}`)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" style={{ breakInside: "avoid" }}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-semibold text-slate-900">{recommendation.name || "Responsable"}</h4>
                            <p className="text-xs text-slate-600">
                              {recommendation.role || "Verificación profesional"} · {recommendation.company || "Empresa"}
                            </p>
                          </div>
                          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            {recommendation.verified ? "Recomendación verificada" : "Recomendación"}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-700">{recommendation.text || "Validación profesional registrada."}</p>
                        <p className="mt-2 text-xs text-slate-500">{formatDate(recommendation.date)}</p>
                      </article>
                    ))}
                  </div>
                ) : internalPreview ? (
                  <Empty text="No hay recomendaciones públicas disponibles por ahora." />
                ) : null}
              </Card>
            ) : null}

            {showLanguagesTab ? (
              <Card title="Idiomas y credenciales" subtitle="Idiomas como señal laboral y logros/certificaciones visibles del perfil.">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h4 className="text-sm font-semibold text-slate-900">Idiomas</h4>
                    <p className="mt-1 text-xs text-slate-500">Presentados como señal laboral directa con nivel visible.</p>
                    {publicLanguages.length ? (
                      <div className="mt-3 space-y-2">
                        {publicLanguages.map((language) => (
                          <div key={language} className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-900">
                            {language}
                          </div>
                        ))}
                      </div>
                    ) : internalPreview ? (
                      <Empty text="Idiomas no añadidos." />
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h4 className="text-sm font-semibold text-slate-900">Certificaciones y logros</h4>
                    <p className="mt-1 text-xs text-slate-500">Credenciales complementarias que refuerzan el perfil sin mezclar idiomas.</p>
                    {achievements.length ? (
                      <ul className="mt-3 space-y-2">
                        {achievements.map((achievement, idx) => (
                          <li key={`${achievement}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                            {achievement}
                          </li>
                        ))}
                      </ul>
                    ) : displaySummary.achievementsCount > 0 ? (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {displaySummary.achievementsCount} {displaySummary.achievementsCount === 1 ? "logro visible" : "logros visibles"}
                      </div>
                    ) : internalPreview ? (
                      <Empty text="Habilidades aun no visibles." />
                    ) : null}
                  </div>
                </div>
              </Card>
            ) : null}

            {isOpenPublicView ? (
              <Card
                title="Este perfil incluye más experiencia verificada y contexto profesional."
                subtitle="Regístrate o desbloquea el perfil completo para acceder a una visión más rica del candidato."
              >
                <div className="flex flex-wrap gap-3">
                  <a
                    href={companyAccessCta.loginUrl}
                    className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                  >
                    Ver perfil completo (-1 acceso)
                  </a>
                  <a
                    href={companyAccessCta.signupUrl}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Registrarse
                  </a>
                </div>
              </Card>
            ) : null}
        </main>
      </div>
    </section>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" style={{ breakInside: "avoid" }}>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function SummaryInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold leading-5 text-slate-900">{value}</div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1">{children}</span>;
}

function MetricChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
      <div className="text-[11px] leading-4 text-slate-500">{label}</div>
      <div className="mt-1 text-xs font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function SignalCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
      <div className="text-[11px] text-slate-600">{hint}</div>
    </div>
  );
}

function TrustBreakdownBar({ label, value }: { label: string; value: number }) {
  const safe = clampPercent(value);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-600">
        <span>{label}</span>
        <span className="font-semibold text-slate-900">{safe}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600" style={{ width: `${safe}%` }} />
      </div>
    </div>
  );
}

function Empty({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <p className={`${compact ? "mt-2" : ""} rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600`}>
      {text}
    </p>
  );
}

export function getTrustLabel(score: number) {
  if (score >= 90) return "Muy alta";
  if (score >= 75) return "Alta";
  if (score >= 55) return "Sólida";
  if (score >= 35) return "Básica";
  return "Inicial";
}

function getProfileVisibilityLabel(raw?: string | null) {
  const value = String(raw || "").toLowerCase();
  if (value === "public_link") return "Perfil público verificable";
  return "Perfil accesible mediante enlace seguro";
}

function getProfileStatusLabel(raw?: string | null, fallback = "Perfil profesional verificable") {
  const value = String(raw || "active").toLowerCase();
  if (value === "deleted") return "Perfil no disponible";
  if (value === "disabled") return "Perfil restringido";
  return fallback;
}

function resolveProfilePresentationState({
  verifiedExperiences,
  evidences,
  recommendations,
}: {
  verifiedExperiences: number;
  evidences: number;
  recommendations: number;
}) {
  const safeVerified = Math.max(0, Number(verifiedExperiences || 0));
  const safeEvidences = Math.max(0, Number(evidences || 0));
  const safeRecommendations = Math.max(0, Number(recommendations || 0));

  if (safeVerified >= 2 && safeEvidences >= 1) {
    return {
      statusTitle: "Perfil verificado",
      statusSubtitle: "Verificación consolidada con experiencia contrastada y soporte documental.",
    };
  }

  if (safeVerified >= 1) {
    return {
      statusTitle: "Perfil parcialmente verificado",
      statusSubtitle: "Ya existen verificaciones registradas en parte del historial profesional.",
    };
  }

  if (safeEvidences > 0 || safeRecommendations > 0) {
    return {
      statusTitle: "Perfil con señales verificables",
      statusSubtitle: "Cuenta con señales de respaldo, aunque aún no hay experiencias verificadas.",
    };
  }

  return {
    statusTitle: "Perfil profesional verificable",
    statusSubtitle: "Aún sin verificaciones registradas",
  };
}

function getStatusBadge(statusText?: string | null) {
  const status = normalizeEmploymentRecordVerificationStatus(statusText);

  if (status === EMPLOYMENT_RECORD_VERIFICATION_STATUS.VERIFIED) {
    return { label: "Verificada", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  }
  if (status === EMPLOYMENT_RECORD_VERIFICATION_STATUS.VERIFICATION_REQUESTED) {
    return { label: "Validación en curso", className: "border-amber-200 bg-amber-50 text-amber-700" };
  }
  if (status === EMPLOYMENT_RECORD_VERIFICATION_STATUS.REJECTED) {
    return { label: "Declarada", className: "border-slate-300 bg-slate-100 text-slate-700" };
  }
  return { label: "Declarada", className: "border-slate-300 bg-slate-100 text-slate-700" };
}

function getCompanyStatusBadge(statusText?: string | null) {
  const status = String(statusText || "").toLowerCase();
  if (status === "registered_in_verijob") {
    return { label: "Empresa registrada", className: "border-indigo-200 bg-indigo-50 text-indigo-700" };
  }
  if (status === "verified_paid") {
    return { label: "Empresa verificada", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  }
  if (status === "verified_document") {
    return { label: "Empresa validada documentalmente", className: "border-blue-200 bg-blue-50 text-blue-700" };
  }
  if (status === "unverified_external") {
    return { label: "Verificación por email", className: "border-violet-200 bg-violet-50 text-violet-700" };
  }
  return { label: "Empresa no verificada", className: "border-amber-200 bg-amber-50 text-amber-700" };
}

function formatDate(value?: string | null) {
  if (!value) return "Fecha no disponible";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Fecha no disponible";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatMonthYear(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-ES", { month: "short", year: "numeric" });
}

function formatPeriod(start?: string | null, end?: string | null) {
  const startText = formatMonthYear(start);
  const rawEnd = String(end || "").trim().toLowerCase();
  const isCurrent = !rawEnd || rawEnd === "actualidad" || rawEnd === "actual" || rawEnd === "present" || rawEnd === "current";
  const endText = isCurrent ? "Actualidad" : formatMonthYear(end);
  if (!startText && !end) return "Periodo no especificado";
  return `${startText || "Inicio no definido"} · ${endText || "Fin no definido"}`;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}
