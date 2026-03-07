export const dynamic = "force-dynamic";
import type { Metadata } from "next";

type Ctx = { params: Promise<{ token: string }> };
type Teaser = {
  full_name?: string | null;
  title?: string | null;
  location?: string | null;
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
};
type PublicExperience = {
  experience_id?: string | null;
  status_text?: string | null;
  score?: number | null;
  evidence_count?: number | null;
  reuse_count?: number | null;
};

export const metadata: Metadata = {
  title: "Perfil profesional verificable | Verijob",
  description:
    "Perfil profesional verificable con señales públicas de credibilidad laboral para evaluación empresarial.",
};

export default async function PublicCandidateProfilePage({ params }: Ctx) {
  const { token } = await params;
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://app.verijob.es";

  const res = await fetch(`${base}/api/public/candidate/${token}`, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const unavailableReason =
      res.status === 410
        ? "Este enlace ha caducado y ya no está disponible."
        : "Este enlace no existe o no está disponible en este momento.";
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-12">
        <section
          aria-labelledby="public-profile-unavailable-title"
          className="mx-auto max-w-3xl rounded-3xl border bg-white p-10 text-center shadow-sm"
        >
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Verijob</div>
          <h1 id="public-profile-unavailable-title" className="mt-3 text-3xl font-semibold text-slate-900">
            Perfil no disponible
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            {unavailableReason}
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              className="inline-flex min-w-44 items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
              href="/login?mode=company"
              aria-label="Iniciar sesión como empresa en Verijob"
            >
              Iniciar sesión empresa
            </a>
            <a
              className="inline-flex min-w-44 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100"
              href="/signup?mode=company"
              aria-label="Crear cuenta de empresa en Verijob"
            >
              Crear cuenta empresa
            </a>
          </div>
        </section>
      </main>
    );
  }

  const teaser: Teaser = body?.teaser || {};
  const experiences: PublicExperience[] = Array.isArray(body?.experiences) ? body.experiences : [];
  const trust = Number(teaser?.trust_score ?? 0);
  const nextPath = `/company/candidate/${token}`;
  const loginUrl = `/login?mode=company&next=${encodeURIComponent(nextPath)}`;
  const signupUrl = `/signup?mode=company&next=${encodeURIComponent(nextPath)}`;
  const trustLabel = getTrustLabel(trust);
  const trustInterpretation = getTrustInterpretation(trust);
  const profileVisibility = getProfileVisibilityLabel(teaser?.profile_visibility);
  const metrics = [
    { label: "Experiencias", value: Number(teaser?.experiences_total ?? 0), hint: "Trayectoria registrada" },
    { label: "Experiencias verificadas", value: Number(teaser?.verified_experiences ?? 0), hint: "Con validación visible" },
    { label: "Evidencias", value: Number(teaser?.evidences_total ?? 0), hint: "Soporte documental asociado" },
    { label: "Reutilizaciones", value: Number(teaser?.reuse_total ?? 0), hint: "Verificaciones reutilizadas por empresas" },
    { label: "Empresas que reutilizan", value: Number(teaser?.reuse_companies ?? 0), hint: "Organizaciones con uso registrado" },
    { label: "Experiencias confirmadas", value: Number(teaser?.confirmed_experiences ?? 0), hint: "Confirmadas por entidad" },
  ];
  const trustSignals = getTrustSignals({
    trustScore: trust,
    experiencesTotal: Number(teaser?.experiences_total ?? 0),
    verifiedExperiences: Number(teaser?.verified_experiences ?? 0),
    evidencesTotal: Number(teaser?.evidences_total ?? 0),
    reuseTotal: Number(teaser?.reuse_total ?? 0),
  });

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 sm:px-8 sm:py-14">
      <div className="mx-auto max-w-6xl">
        <section className="overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-sm">
          <header className="bg-slate-800 px-6 py-9 text-white sm:px-10 sm:py-12">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Verijob</div>
            <div className="mt-5 flex flex-wrap items-start justify-between gap-5">
              <div className="max-w-3xl">
                <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
                  {teaser?.full_name || "Candidato verificado"}
                </h1>
                <p className="mt-2 text-base font-medium text-slate-200">
                  {teaser?.title || "Perfil profesional verificable"}
                </p>
                {teaser?.location ? (
                  <p className="mt-2 text-sm text-slate-300">Ubicación: {teaser.location}</p>
                ) : null}
                <p className="mt-3 text-sm leading-6 text-slate-200/95">
                  Perfil profesional con credenciales laborales estructuradas y evidencias verificables en VERIJOB.
                </p>
              </div>

              <section
                aria-label="Resumen de credibilidad"
                className="min-w-[220px] rounded-2xl border border-slate-500/70 bg-slate-700 px-6 py-5 text-right shadow-sm"
              >
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">Trust Score</div>
                <div className="mt-1 text-5xl font-bold leading-none text-white">{trust}</div>
                <div className="mt-2 text-sm font-medium text-slate-200">{trustLabel}</div>
                <div className="mt-1 text-xs leading-5 text-slate-200/95">{trustInterpretation}</div>
              </section>
            </div>

            {teaser?.summary ? (
              <p className="mt-6 max-w-4xl text-sm leading-7 text-slate-200/95">{String(teaser.summary)}</p>
            ) : null}
          </header>

          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.5fr_0.9fr] lg:gap-10 lg:px-10 lg:py-10">
            <section aria-labelledby="credibility-title">
              <h2 id="credibility-title" className="text-xl font-semibold text-slate-900">
                Credibilidad profesional
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Indicadores verificables para una evaluación inicial estructurada.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Stat label="Trust Score" value={trust} highlight hint={trustInterpretation} />
                {metrics.map((metric) => (
                  <Stat key={metric.label} label={metric.label} value={metric.value} hint={metric.hint} />
                ))}
              </div>

              <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900">Señales de confianza</h3>
                {trustSignals.length ? (
                  <ul className="mt-4 space-y-2.5">
                    {trustSignals.map((signal) => (
                      <li
                        key={signal}
                        className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-6 text-slate-700"
                      >
                        <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-slate-400" />
                        <span>{signal}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">
                    Este perfil todavía está consolidando señales públicas de confianza.
                  </p>
                )}
              </div>

              <div className="mt-10">
                <h3 className="text-base font-semibold text-slate-900">Experiencias verificables</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Historial profesional con estado, score y evidencias asociadas.
                </p>
                {Number(teaser?.experiences_total ?? 0) === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">
                    A medida que se incorporen experiencias verificables, se ampliará esta vista pública.
                  </p>
                ) : null}

                {experiences.length ? (
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {experiences.map((exp, index) => {
                      const badge = getStatusBadge(exp?.status_text);
                      return (
                        <article
                          key={String(exp?.experience_id || `exp-${index}`)}
                          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <h4 className="text-sm font-semibold text-slate-900">Experiencia {index + 1}</h4>
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          </div>

                          <dl className="mt-3 space-y-2 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <dt className="text-slate-500">Estado</dt>
                              <dd className="font-medium text-slate-800">{exp?.status_text || "unknown"}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <dt className="text-slate-500">Score</dt>
                              <dd className="font-medium text-slate-900">{Number(exp?.score ?? 0)}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <dt className="text-slate-500">Evidencias</dt>
                              <dd className="font-medium text-slate-900">{Number(exp?.evidence_count ?? 0)}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <dt className="text-slate-500">Reutilizaciones</dt>
                              <dd className="font-medium text-slate-900">{Number(exp?.reuse_count ?? 0)}</dd>
                            </div>
                          </dl>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    {Number(teaser?.experiences_total ?? 0) > 0
                      ? "Las experiencias de este perfil se encuentran en proceso de revisión o verificación."
                      : "Aún no hay experiencias profesionales visibles en este perfil."}
                  </div>
                )}
              </div>
            </section>

            <aside className="space-y-5" aria-label="Información complementaria para empresa">
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-800">Estado público</h3>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  Candidatura verificable accesible mediante enlace seguro.
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Visibilidad: <span className="font-semibold text-slate-900">{profileVisibility}</span>
                </p>
                <p className="mt-3 text-xs leading-5 text-slate-600">
                  Este perfil incluye credenciales laborales estructuradas y evidencias documentales registradas en
                  VERIJOB.
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  Para una revisión completa, accede a la vista empresarial ampliada.
                </p>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-800">
                  Acceso empresa
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Accede a la vista empresarial para consultar detalles verificables de la trayectoria profesional.
                </p>

                <div className="mt-5 flex flex-col gap-2.5">
                  <a
                    className="inline-flex items-center justify-center rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900"
                    href={signupUrl}
                    aria-label="Crear cuenta de empresa para ver la versión ampliada"
                  >
                    Crear cuenta de empresa
                  </a>
                  <a
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                    href={loginUrl}
                    aria-label="Iniciar sesión como empresa para continuar la evaluación"
                  >
                    Iniciar sesión como empresa
                  </a>
                </div>
              </section>

              <p className="px-1 text-xs text-slate-500">
                Enlace público verificable generado por VERIJOB.
              </p>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  highlight = false,
  hint,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  hint?: string;
}) {
  return (
    <div
      className={
        highlight
          ? "rounded-2xl border border-slate-800 bg-slate-800 p-4 text-white shadow-sm"
          : "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      }
    >
      <div className={highlight ? "text-xs font-medium text-slate-300" : "text-xs font-medium text-slate-500"}>{label}</div>
      <div className={highlight ? "mt-1 text-3xl font-bold" : "mt-1 text-3xl font-semibold text-slate-900"}>
        {value}
      </div>
      {hint ? (
        <div className={highlight ? "mt-1 text-xs leading-5 text-slate-200/90" : "mt-1 text-xs leading-5 text-slate-500"}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function getTrustLabel(score: number) {
  if (score >= 80) return "Credibilidad alta";
  if (score >= 60) return "Credibilidad sólida";
  if (score >= 40) return "Credibilidad media";
  return "Credibilidad inicial";
}

function getTrustInterpretation(score: number) {
  if (score === 0) return "Perfil en fase inicial de verificación.";
  if (score >= 80) return "Perfil con credenciales verificables.";
  return "Perfil con señales de credibilidad en consolidación.";
}

function getProfileVisibilityLabel(raw?: string | null) {
  const value = String(raw || "").toLowerCase();
  if (value === "public_link") return "Perfil público verificable";
  if (!value) return "Perfil accesible mediante enlace seguro";
  return "Perfil accesible mediante enlace seguro";
}

function getStatusBadge(statusText?: string | null) {
  const status = String(statusText || "").toLowerCase().trim();

  if (status === "verified") {
    return { label: "verified", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  }
  if (status === "reviewing") {
    return { label: "reviewing", className: "border-amber-200 bg-amber-50 text-amber-700" };
  }
  if (status === "pending_company") {
    return { label: "pending_company", className: "border-slate-300 bg-slate-100 text-slate-700" };
  }
  if (status === "rejected") {
    return { label: "rejected", className: "border-rose-200 bg-rose-50 text-rose-700" };
  }

  return { label: statusText || "unknown", className: "border-slate-300 bg-slate-100 text-slate-700" };
}

function getTrustSignals(input: {
  trustScore: number;
  experiencesTotal: number;
  verifiedExperiences: number;
  evidencesTotal: number;
  reuseTotal: number;
}) {
  const signals: string[] = [];

  if (input.evidencesTotal > 0) signals.push("Trazabilidad documental disponible");
  if (input.verifiedExperiences > 0) signals.push("Experiencias con verificación visible");
  if (input.reuseTotal > 0) signals.push("Historial reutilizado en procesos empresariales");
  if (input.experiencesTotal > 0) signals.push("Trayectoria profesional estructurada");
  if (input.trustScore >= 80) signals.push("Perfil con señales sólidas de credibilidad");

  return signals;
}
