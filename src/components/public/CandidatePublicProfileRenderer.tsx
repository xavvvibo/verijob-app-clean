"use client";

import React, { useMemo, useState } from "react";
import { normalizePublicLanguages } from "@/lib/public/profile-languages";

export type PublicProfilePreviewMode = "public" | "registered" | "requesting" | "full";

export type PublicCandidateTeaser = {
  full_name?: string | null;
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
  trust_score_breakdown?: {
    verification?: number;
    evidence?: number;
    consistency?: number;
    reuse?: number;
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
  { key: "languages", label: "Idiomas y logros" },
];

function getModeCapabilities(mode: PublicProfilePreviewMode) {
  return {
    showTrustScore: mode !== "public",
    showContact: mode === "full",
    maxExperiences: mode === "public" ? 8 : 24,
  };
}

export function CandidatePublicProfileRenderer({
  payload,
  mode = "public",
  companyAccess = true,
  contact,
}: {
  payload: PublicCandidatePayload;
  mode?: PublicProfilePreviewMode;
  companyAccess?: boolean;
  contact?: PublicCandidateContact;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const teaser: PublicCandidateTeaser = payload?.teaser || {};
  const allExperiences: PublicCandidateExperience[] = Array.isArray(payload?.experiences)
    ? payload.experiences
    : [];
  const education: PublicCandidateEducation[] = Array.isArray(payload?.education) ? payload.education : [];
  const recommendations: PublicCandidateRecommendation[] = Array.isArray(payload?.recommendations)
    ? payload.recommendations
    : [];
  const achievements = Array.isArray(payload?.achievements) ? payload.achievements : [];
  const skills = Array.isArray(payload?.verified_skills) ? payload.verified_skills : [];

  const capabilities = getModeCapabilities(mode);
  const experiences = allExperiences.slice(0, capabilities.maxExperiences);
  const publicLanguages = normalizePublicLanguages(teaser?.languages);

  const trust = Number(teaser?.trust_score ?? 0);
  const trustLabel = getTrustLabel(trust);
  const profileVisibility = getProfileVisibilityLabel(teaser?.profile_visibility);
  const profileStatus = getProfileStatusLabel(teaser?.lifecycle_status);

  const token = payload?.token;
  const nextPath = token ? `/company/candidate/${token}` : "/company/candidates";
  const loginUrl = `/login?mode=company&next=${encodeURIComponent(nextPath)}`;
  const signupUrl = `/signup?mode=company&next=${encodeURIComponent(nextPath)}`;
  const profileUrl = token
    ? `${typeof window !== "undefined" ? window.location.origin : "https://app.verijob.es"}/p/${token}`
    : null;
  const qrEnabled = Boolean(teaser?.qr_enabled);
  const qrImageUrl = token && qrEnabled ? `/api/public/candidate/${token}/qr.svg` : null;

  const trustProgress = Math.min(100, Math.max(0, trust));
  const trustRingStyle = {
    background: `conic-gradient(#1d4ed8 ${trustProgress * 3.6}deg, #dbeafe 0deg)`,
  };

  const verificationSummary = useMemo(() => {
    return {
      experiences: Number(teaser?.experiences_total ?? experiences.length),
      verified: Number(teaser?.verified_experiences ?? experiences.filter((e) => Boolean(e.is_verified)).length),
      evidences: Number(teaser?.evidences_total ?? 0),
      reuse: Number(teaser?.reuse_total ?? 0),
    };
  }, [teaser, experiences]);

  return (
    <section className="rounded-[30px] border border-slate-200 bg-slate-50/60 p-3 shadow-sm sm:p-4">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <header className="sticky top-4 z-20 rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-lg backdrop-blur sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-xl font-bold text-white shadow-sm">
                  {getInitials(teaser?.full_name || "Candidato")}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">VERIJOB · {modeLabels[mode]}</div>
                  <h1 className="mt-1 truncate text-2xl font-semibold text-slate-900 sm:text-3xl">
                    {teaser?.full_name || "Candidato verificado"}
                  </h1>
                  <p className="mt-1 text-sm font-medium text-blue-800">{teaser?.title || "Perfil profesional verificable"}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Perfil profesional con experiencia y documentación laboral verificadas.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                    {teaser?.location ? <Pill>{teaser.location}</Pill> : null}
                    {teaser?.sector ? <Pill>{teaser.sector}</Pill> : null}
                    {teaser?.work_mode ? <Pill>{teaser.work_mode}</Pill> : null}
                    {teaser?.availability ? <Pill>{teaser.availability}</Pill> : null}
                    <Pill>{profileVisibility}</Pill>
                    <Pill>{profileStatus}</Pill>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
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
                  Compartir perfil verificado
                </button>
                <a
                  href={loginUrl}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Ver evaluación empresa
                </a>
              </div>
            </div>
            {shareMessage ? (
              <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800">
                {shareMessage}
              </div>
            ) : null}

            <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-700">
              {teaser?.summary ||
                "Perfil profesional verificable con historial laboral estructurado, señales de confianza y validación por empresa/documentación sin exponer archivos privados."}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
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
          </header>

          <main className="space-y-4">
            {activeTab === "profile" ? (
              <>
                <Card title="Resumen profesional" subtitle="Información principal del perfil verificable.">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <Stat label="Experiencias" value={verificationSummary.experiences} />
                    <Stat label="Verificadas" value={verificationSummary.verified} />
                    <Stat label="Evidencias" value={verificationSummary.evidences} />
                    <Stat label="Reutilizaciones" value={verificationSummary.reuse} />
                    <Stat label="Formación" value={Number(teaser?.education_total ?? education.length)} />
                    <Stat label="Logros" value={Number(teaser?.achievements_total ?? achievements.length)} />
                  </div>
                </Card>

                <Card title="Habilidades verificadas" subtitle="Derivadas de experiencia y señales de verificación.">
                  {skills.length ? (
                    <div className="flex flex-wrap gap-2">
                      {skills.map((skill) => (
                        <span key={skill} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <Empty text="Sin habilidades verificadas visibles por ahora." />
                  )}
                </Card>

                <Card title="Datos clave" subtitle="Solo datos públicos y relevantes para evaluación profesional.">
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <Item label="Ubicación" value={teaser?.location || "No especificada"} />
                    <Item label="Título profesional" value={teaser?.title || "No especificado"} />
                    <Item label="Idiomas" value={publicLanguages.length ? publicLanguages.join(", ") : "No indicados"} />
                    <Item label="Estado de perfil" value={profileStatus} />
                  </dl>
                </Card>
              </>
            ) : null}

            {activeTab === "experience" ? (
              <Card title="Experiencia profesional" subtitle="Historial en formato verificable con badges de validación (sin documentos privados).">
                {experiences.length ? (
                  <div className="space-y-3">
                    {experiences.map((exp, index) => {
                      const statusBadge = getStatusBadge(exp?.status_text);
                      const companyStatusBadge = getCompanyStatusBadge(exp?.company_verification_status_snapshot);
                      const badges = Array.isArray(exp?.verification_badges) ? exp.verification_badges : [];
                      return (
                        <article
                          key={String(exp?.experience_id || `exp-${index}`)}
                          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h4 className="text-base font-semibold text-slate-900">{exp?.position || "Experiencia"}</h4>
                              <p className="text-sm text-slate-600">{exp?.company_name || "Empresa no especificada"}</p>
                              <p className="mt-1 text-xs text-slate-500">{formatPeriod(exp?.start_date, exp?.end_date)}</p>
                            </div>
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadge.className}`}>
                              {statusBadge.label}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {badges.map((badge) => (
                              <span
                                key={`${exp?.experience_id || index}-${badge}`}
                                className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800"
                              >
                                {badge}
                              </span>
                            ))}
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${companyStatusBadge.className}`}>
                              {companyStatusBadge.label}
                            </span>
                          </div>

                          <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                            <div>Credibilidad: <span className="font-semibold text-slate-900">{Number(exp?.score ?? 0)}</span></div>
                            <div>Evidencias asociadas: <span className="font-semibold text-slate-900">{Number(exp?.evidence_count ?? 0)}</span></div>
                            <div>Reutilizaciones: <span className="font-semibold text-slate-900">{Number(exp?.reuse_count ?? 0)}</span></div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <Empty text="No hay experiencias visibles en este perfil público." />
                )}
              </Card>
            ) : null}

            {activeTab === "education" ? (
              <Card title="Formación" subtitle="Trayectoria académica visible del candidato.">
                {education.length ? (
                  <div className="space-y-3">
                    {education.map((item, idx) => (
                      <article key={String(item.id || `edu-${idx}`)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
                ) : (
                  <Empty text="No hay formación pública visible todavía." />
                )}
              </Card>
            ) : null}

            {activeTab === "recommendations" ? (
              <Card title="Recomendaciones" subtitle="Validaciones profesionales visibles en el perfil público.">
                {recommendations.length ? (
                  <div className="space-y-3">
                    {recommendations.map((recommendation, idx) => (
                      <article key={String(recommendation.id || `rec-${idx}`)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
                ) : (
                  <Empty text="No hay recomendaciones públicas disponibles por ahora." />
                )}
              </Card>
            ) : null}

            {activeTab === "languages" ? (
              <Card title="Idiomas y logros" subtitle="Competencias e hitos públicos del perfil.">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h4 className="text-sm font-semibold text-slate-900">Idiomas</h4>
                    {publicLanguages.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {publicLanguages.map((language) => (
                          <span key={language} className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-800">
                            {language}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <Empty text="No hay idiomas visibles." />
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h4 className="text-sm font-semibold text-slate-900">Logros y certificaciones</h4>
                    {achievements.length ? (
                      <ul className="mt-3 space-y-2">
                        {achievements.map((achievement, idx) => (
                          <li key={`${achievement}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                            {achievement}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Empty text="No hay logros públicos visibles." />
                    )}
                  </div>
                </div>
              </Card>
            ) : null}
          </main>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Trust Score</h3>
            <div className="mt-3 flex items-center gap-4">
              <div className="relative h-20 w-20 rounded-full p-1" style={trustRingStyle}>
                <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-2xl font-bold text-slate-900">
                  {trust}
                </div>
              </div>
              <div>
                <div className="text-base font-semibold text-slate-900">{trustLabel}</div>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Basado en verificaciones laborales, trazabilidad documental y consistencia del historial.
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-3 text-xs text-slate-700">
              <div className="font-semibold text-slate-900">Qué refuerza este score</div>
              <ul className="mt-2 space-y-1.5">
                <li>Experiencias verificadas: {verificationSummary.verified}</li>
                <li>Verificaciones empresariales: {Number(teaser?.confirmed_experiences ?? 0)}</li>
                <li>Documentos laborales validados: {verificationSummary.evidences}</li>
                <li>Recomendaciones verificadas: {recommendations.length}</li>
              </ul>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <MetricChip label="Experiencias verificadas" value={verificationSummary.verified} />
              <MetricChip label="Verificaciones empresariales" value={Number(teaser?.confirmed_experiences ?? 0)} />
              <MetricChip label="Docs validados" value={verificationSummary.evidences} />
              <MetricChip label="Recomendaciones" value={recommendations.length} />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Habilidades clave</h3>
            {skills.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {skills.slice(0, 10).map((skill) => (
                  <span key={`side-${skill}`} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <Empty text="Se mostrarán cuando haya señales públicas suficientes." compact />
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Formación destacada</h3>
            {education.length ? (
              <ul className="mt-3 space-y-2">
                {education.slice(0, 3).map((item, idx) => (
                  <li key={`side-edu-${item.id || idx}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-900">{item.title || "Formación"}</p>
                    <p className="text-[11px] text-slate-600">{item.institution || "Centro no indicado"}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty text="Sin formación destacada visible." compact />
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Recomendaciones destacadas</h3>
            {recommendations.length ? (
              <ul className="mt-3 space-y-2">
                {recommendations.slice(0, 3).map((recommendation, idx) => (
                  <li key={`side-rec-${recommendation.id || idx}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-900">{recommendation.company || "Empresa"}</p>
                    <p className="line-clamp-2 text-[11px] text-slate-600">{recommendation.text || "Validación profesional registrada."}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty text="Sin recomendaciones destacadas visibles." compact />
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">QR de tu perfil verificado</h3>
            {qrEnabled && qrImageUrl ? (
              <>
                <p className="mt-2 text-xs leading-5 text-slate-600">Escanea para ver este perfil verificado.</p>
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrImageUrl}
                    alt="QR del perfil verificado"
                    className="mx-auto h-auto w-full max-w-[200px] rounded-lg object-contain"
                  />
                </div>
              </>
            ) : (
              <Empty text="Disponible con planes de suscripción que habilitan QR público del perfil." compact />
            )}
          </section>

          {capabilities.showContact ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Contacto visible</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <p>Email: <span className="font-medium text-slate-900">{contact?.email || "No disponible"}</span></p>
                <p>Teléfono: <span className="font-medium text-slate-900">{contact?.phone || "No disponible"}</span></p>
              </div>
            </section>
          ) : null}

          {companyAccess ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Acceso empresa</h3>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                Para acceder a más contexto operativo, utiliza la vista de empresa.
              </p>
              <div className="mt-4 space-y-2">
                <a className="inline-flex w-full justify-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800" href={signupUrl}>
                  Crear cuenta empresa
                </a>
                <a className="inline-flex w-full justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100" href={loginUrl}>
                  Iniciar sesión empresa
                </a>
              </div>
            </section>
          ) : null}
        </aside>
      </div>

      <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-sm">
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
          className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
        >
          Compartir perfil verificado
        </button>
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
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
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

function Empty({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <p className={`${compact ? "mt-2" : ""} rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600`}>
      {text}
    </p>
  );
}

function getInitials(name: string) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "VJ";
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
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

function getProfileStatusLabel(raw?: string | null) {
  const value = String(raw || "active").toLowerCase();
  if (value === "deleted") return "Perfil no disponible";
  if (value === "disabled") return "Perfil restringido";
  return "Perfil verificado";
}

function getStatusBadge(statusText?: string | null) {
  const status = String(statusText || "").toLowerCase().trim();

  if (status === "verified" || status === "approved") {
    return { label: "Verificada", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  }
  if (status === "reviewing") {
    return { label: "En revisión", className: "border-amber-200 bg-amber-50 text-amber-700" };
  }
  if (status === "pending_company") {
    return { label: "Pendiente empresa", className: "border-slate-300 bg-slate-100 text-slate-700" };
  }
  if (status === "rejected") {
    return { label: "Rechazada", className: "border-rose-200 bg-rose-50 text-rose-700" };
  }
  if (status === "revoked") {
    return { label: "Revocada", className: "border-rose-200 bg-rose-50 text-rose-700" };
  }

  return { label: "Sin estado", className: "border-slate-300 bg-slate-100 text-slate-700" };
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
  const endText = end ? formatMonthYear(end) : "Actualidad";
  if (!startText && !end) return "Periodo no especificado";
  return `${startText || "Inicio no definido"} · ${endText}`;
}
