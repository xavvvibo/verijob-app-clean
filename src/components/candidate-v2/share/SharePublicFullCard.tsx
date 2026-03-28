import React from "react";
import {
  getInitialsFromDisplayName,
  resolvePublicCandidateDisplayName,
  resolvePublicProfileDisplaySummary,
} from "@/lib/public/candidate-profile-display";

type AnyData = Record<string, any>;

function getSource(props: AnyData): AnyData {
  return (
    props?.data ??
    props?.preview ??
    props?.profile ??
    props?.payload ??
    props?.candidate ??
    props?.publicProfile ??
    props?.candidateProfile ??
    props ??
    {}
  );
}

function pickFirstString(...values: any[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function getNested(source: AnyData, path: string): any {
  return path.split(".").reduce((acc: any, key) => acc?.[key], source);
}

function getExperiences(source: AnyData): any[] {
  const candidates = [
    source?.experiences,
    source?.profile_experiences,
    source?.employmentRecords,
    source?.employment_records,
    source?.items,
    source?.timeline,
    getNested(source, "candidate_profile.experiences"),
    getNested(source, "candidate_profile.profile_experiences"),
    getNested(source, "profile.experiences"),
    getNested(source, "profile.profile_experiences"),
  ];
  const arr = candidates.find((v) => Array.isArray(v));
  return Array.isArray(arr) ? arr : [];
}

function getTrustScore(source: AnyData): number | null {
  const raw =
    source?.trustScore ??
    source?.trust_score ??
    source?.candidate_profile?.trust_score ??
    source?.profile?.trust_score ??
    source?.score ??
    getNested(source, "candidateProfile.trust_score") ??
    null;

  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function getTitle(source: AnyData): string {
  return (
    pickFirstString(
      source?.title,
      source?.headline,
      source?.job_title,
      source?.professional_title,
      source?.candidate_title,
      source?.role,
      getNested(source, "candidate_profile.title"),
      getNested(source, "candidate_profile.professional_title"),
      getNested(source, "profile.title"),
      getNested(source, "profile.professional_title")
    ) ?? "Perfil verificable"
  );
}

function getLocation(source: AnyData): string | null {
  return pickFirstString(
    source?.location,
    source?.city,
    source?.candidate_location,
    getNested(source, "candidate_profile.location"),
    getNested(source, "profile.location")
  );
}

function getAvailability(source: AnyData): string | null {
  return pickFirstString(
    source?.availability,
    source?.candidate_availability,
    source?.open_to_work,
    source?.status_availability,
    getNested(source, "candidate_profile.availability"),
    getNested(source, "profile.availability")
  );
}

function formatDate(raw: any): string | null {
  if (!raw) return null;
  const text = String(raw);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const [year, month] = text.slice(0, 10).split("-");
    return `${month}/${year}`;
  }
  if (/^\d{4}-\d{2}$/.test(text)) {
    const [year, month] = text.split("-");
    return `${month}/${year}`;
  }
  return text;
}

function normalizeExperience(exp: AnyData, index: number) {
  return {
    id: exp?.id ?? `exp-${index}`,
    title:
      exp?.title ??
      exp?.position ??
      exp?.job_title ??
      exp?.role ??
      "Experiencia profesional",
    company:
      exp?.company ??
      exp?.company_name ??
      exp?.employer ??
      exp?.organization ??
      null,
    start:
      formatDate(exp?.start_date ?? exp?.date_start ?? exp?.from ?? exp?.started_at),
    end:
      formatDate(exp?.end_date ?? exp?.date_end ?? exp?.to ?? exp?.ended_at ?? exp?.current_until),
    status:
      exp?.verification_status ??
      exp?.status ??
      exp?.verificationState ??
      exp?.state ??
      "",
    description:
      exp?.description ??
      exp?.summary ??
      exp?.details ??
      null,
  };
}

export default function SharePublicFullCard(props: AnyData) {
  const source = getSource(props);
  const experiences = getExperiences(source).map(normalizeExperience);
  const trustScore = getTrustScore(source);
  const displayName = resolvePublicCandidateDisplayName(source);
  const displaySummary = resolvePublicProfileDisplaySummary(source);
  const title = getTitle(source);
  const location = getLocation(source);
  const availability = getAvailability(source);

  const verifiedCount = experiences.filter((exp) => {
    const text = String(exp.status).toLowerCase();
    return text.includes("verified") || text.includes("verificada");
  }).length;

  const inProgressCount = experiences.filter((exp) => {
    const text = String(exp.status).toLowerCase();
    return text.includes("process") || text.includes("curso") || text.includes("pending");
  }).length;

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex flex-col gap-8">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500 text-xl font-semibold text-white">
            {getInitialsFromDisplayName(displayName)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Vista completa
            </div>
            <h3 className="truncate text-[36px] font-semibold tracking-[-0.03em] text-slate-950">
              {displayName}
            </h3>
            <p className="mt-1 text-[15px] text-slate-600">{title}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {location ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] text-slate-600">
                  {location}
                </span>
              ) : null}
              {availability ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] text-slate-600">
                  {availability}
                </span>
              ) : null}
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] text-slate-600">
                Perfil público verificable
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Verificaciones
            </div>
            <div className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-slate-950">
              {verifiedCount}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              En proceso
            </div>
            <div className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-slate-950">
              {inProgressCount}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Evidencias
            </div>
            <div className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-slate-950">
              {source?.evidences_count ?? source?.evidence_count ?? 0}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Trust score
            </div>
            <div className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-slate-950">
              {trustScore ?? "—"}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Formacion
            </div>
            <div className="mt-2 text-[16px] font-semibold text-slate-950">
              {displaySummary.educationLabel}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Idiomas
            </div>
            <div className="mt-2 text-[16px] font-semibold text-slate-950">
              {displaySummary.languagesLabel}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Habilidades y logros
            </div>
            <div className="mt-2 text-[16px] font-semibold text-slate-950">
              {displaySummary.capabilitiesLabel}
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-6">
          <div className="mb-4 text-[13px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Historial verificable
          </div>

          <div className="flex flex-col gap-4">
            {experiences.length ? (
              experiences.map((exp) => (
                <div
                  key={exp.id}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-[18px] font-semibold text-slate-950">
                        {exp.title}
                      </div>
                      {exp.company ? (
                        <div className="mt-1 text-[14px] text-slate-600">{exp.company}</div>
                      ) : null}
                      <div className="mt-2 text-[12px] uppercase tracking-[0.14em] text-slate-400">
                        {[exp.start, exp.end].filter(Boolean).join(" · ")}
                      </div>
                    </div>

                    {exp.status ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] text-slate-600">
                        {String(exp.status)}
                      </span>
                    ) : null}
                  </div>

                  {exp.description ? (
                    <p className="mt-3 text-[14px] leading-6 text-slate-600">
                      {exp.description}
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-4 text-[14px] text-slate-600">
                No hay experiencias disponibles para esta vista completa todavía.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
