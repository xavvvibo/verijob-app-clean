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

function countVerified(experiences: any[]): number {
  return experiences.filter((exp) => {
    const raw =
      exp?.verification_status ??
      exp?.status ??
      exp?.verificationState ??
      exp?.state ??
      exp?.verification?.status ??
      "";
    const text = String(raw).toLowerCase();
    return (
      text.includes("verified") ||
      text.includes("verificada") ||
      text.includes("validada") ||
      text === "completed"
    );
  }).length;
}

function getAvailability(source: AnyData): string | null {
  const raw =
    source?.availability ??
    source?.candidate_availability ??
    source?.open_to_work ??
    source?.status_availability ??
    getNested(source, "candidate_profile.availability") ??
    getNested(source, "profile.availability") ??
    null;

  if (!raw) return null;
  const text = String(raw).trim();
  return text || null;
}

export default function SharePublicCompactCard(props: AnyData) {
  const source = getSource(props);
  const experiences = getExperiences(source);
  const totalExperiences = experiences.length;
  const verifiedExperiences = countVerified(experiences);
  const trustScore = getTrustScore(source);
  const displayName = resolvePublicCandidateDisplayName(source);
  const displaySummary = resolvePublicProfileDisplaySummary(source);
  const title = getTitle(source);
  const location = getLocation(source);
  const availability = getAvailability(source);

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex flex-col gap-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500 text-lg font-semibold text-white">
            {getInitialsFromDisplayName(displayName)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Vista pública resumida
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
                Perfil verificable
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Experiencias registradas
            </div>
            <div className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-slate-950">
              {totalExperiences}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Experiencias verificadas
            </div>
            <div className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-slate-950">
              {verifiedExperiences}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Formacion
            </div>
            <div className="mt-2 text-[16px] font-semibold tracking-[-0.02em] text-slate-950">
              {displaySummary.educationLabel}
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-[14px] text-slate-600">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Idiomas
            </div>
            <div className="mt-2 text-[14px] font-medium text-slate-700">{displaySummary.languagesLabel}</div>
          </div>
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-[14px] text-slate-600">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Habilidades y logros
            </div>
            <div className="mt-2 text-[14px] font-medium text-slate-700">{displaySummary.capabilitiesLabel}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-[14px] text-slate-600">
          Esta vista resumida prioriza señales agregadas. La vista completa conserva el detalle verificable sin inventar informacion.
        </div>
      </div>
    </div>
  );
}
