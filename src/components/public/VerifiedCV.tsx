import type { PublicCandidatePayload } from "@/components/public/CandidatePublicProfileRenderer";

type Props = {
  data: PublicCandidatePayload;
};

function formatPeriod(start?: string | null, end?: string | null) {
  const startText = start ? new Date(start).toLocaleDateString("es-ES", { month: "short", year: "numeric" }) : "";
  const endText = end ? new Date(end).toLocaleDateString("es-ES", { month: "short", year: "numeric" }) : "Actualidad";
  if (!startText && !end) return "";
  return `${startText || "Inicio no definido"} · ${endText}`;
}

export default function VerifiedCV({ data }: Props) {
  const teaser = data?.teaser || {};
  const experiences = Array.isArray(data?.experiences) ? data.experiences : [];
  const education = Array.isArray(data?.education) ? data.education : [];
  const recommendations = Array.isArray(data?.recommendations) ? data.recommendations : [];
  const languages = Array.isArray(teaser?.languages) ? teaser.languages : [];
  const achievements = Array.isArray(data?.achievements) ? data.achievements : [];
  const trustComponents = teaser?.trust_score_components || teaser?.trust_score_breakdown || null;

  return (
    <div className="mx-auto max-w-4xl bg-white px-6 py-10 text-slate-900">
      <header className="border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-semibold">{teaser?.full_name || "Candidato verificado"}</h1>
        {teaser?.title ? <p className="mt-1 text-base text-slate-700">{teaser.title}</p> : null}
        <p className="mt-1 text-sm text-slate-600">Perfil profesional con señales verificables para evaluación empresarial.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
          {teaser?.location ? <span className="rounded-full border border-slate-200 px-2.5 py-1">{teaser.location}</span> : null}
          <span className="rounded-full border border-slate-200 px-2.5 py-1">Trust Score: {Number(teaser?.trust_score ?? 0)}</span>
          <span className="rounded-full border border-slate-200 px-2.5 py-1">Verificadas: {Number(teaser?.verified_experiences ?? 0)}</span>
          <span className="rounded-full border border-slate-200 px-2.5 py-1">Evidencias: {Number(teaser?.evidences_total ?? 0)}</span>
        </div>
      </header>

      {teaser?.summary ? (
        <section className="mt-6 break-inside-avoid rounded-xl border border-slate-200 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Resumen</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">{teaser.summary}</p>
        </section>
      ) : null}

      {trustComponents ? (
        <section className="mt-6 break-inside-avoid rounded-xl border border-slate-200 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Desglose de confianza</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <TrustItem label="Verificaciones" value={Number((trustComponents as any)?.verification ?? 0)} />
            <TrustItem label="Evidencias" value={Number((trustComponents as any)?.evidence ?? 0)} />
            <TrustItem label="Consistencia" value={Number((trustComponents as any)?.consistency ?? 0)} />
            <TrustItem label="Reutilización" value={Number((trustComponents as any)?.reuse ?? 0)} />
          </div>
        </section>
      ) : null}

      {experiences.length ? (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Experiencia</h2>
          <div className="mt-3 space-y-3">
            {experiences.map((exp, index) => (
              <article
                key={String(exp?.experience_id || `exp-${index}`)}
                className="break-inside-avoid rounded-xl border border-slate-200 p-4"
              >
                <h3 className="font-semibold">{exp?.position || "Experiencia"}</h3>
                <p className="text-sm text-slate-700">{exp?.company_name || "Empresa no indicada"}</p>
                <p className="mt-1 text-xs text-slate-500">{formatPeriod(exp?.start_date, exp?.end_date)}</p>
                {Array.isArray(exp?.verification_badges) && exp.verification_badges.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {exp.verification_badges.map((badge) => (
                      <span key={`${exp?.experience_id}-${badge}`} className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                        {badge}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {education.length ? (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Formación</h2>
          <div className="mt-3 space-y-3">
            {education.map((item, idx) => (
              <article key={String(item?.id || `edu-${idx}`)} className="break-inside-avoid rounded-xl border border-slate-200 p-4">
                <h3 className="font-semibold">{item?.title || "Formación"}</h3>
                {item?.institution ? <p className="text-sm text-slate-700">{item.institution}</p> : null}
                {(item?.start_date || item?.end_date) ? <p className="mt-1 text-xs text-slate-500">{formatPeriod(item?.start_date, item?.end_date)}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {(languages.length || achievements.length) ? (
        <section className="mt-6 break-inside-avoid rounded-xl border border-slate-200 p-4">
          <h2 className="text-lg font-semibold">Idiomas y logros</h2>
          {languages.length ? <p className="mt-2 text-sm text-slate-700"><span className="font-medium">Idiomas:</span> {languages.join(", ")}</p> : null}
          {achievements.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {achievements.map((item, idx) => <li key={`${item}-${idx}`}>{item}</li>)}
            </ul>
          ) : null}
        </section>
      ) : null}

      {recommendations.length ? (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Recomendaciones</h2>
          <div className="mt-3 space-y-3">
            {recommendations.map((item, idx) => (
              <article key={String(item?.id || `rec-${idx}`)} className="break-inside-avoid rounded-xl border border-slate-200 p-4">
                <p className="text-sm leading-6 text-slate-700">{item?.text || "Validación profesional registrada."}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {item?.name || "Responsable"} · {item?.role || "Verificación profesional"} {item?.company ? `· ${item.company}` : ""}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function TrustItem({ label, value }: { label: string; value: number }) {
  const safe = Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>{label}</span>
        <span className="font-semibold text-slate-900">{safe}%</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600" style={{ width: `${safe}%` }} />
      </div>
    </div>
  );
}
