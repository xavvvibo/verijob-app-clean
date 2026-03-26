import React from "react";

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

function getExperiences(source: AnyData): any[] {
  const candidates = [
    source?.experiences,
    source?.profile_experiences,
    source?.employmentRecords,
    source?.employment_records,
    source?.items,
    source?.timeline,
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
    null;

  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function getTitle(source: AnyData): string {
  return (
    source?.title ??
    source?.headline ??
    source?.job_title ??
    source?.professional_title ??
    source?.candidate_title ??
    source?.role ??
    "Perfil verificable"
  );
}

function getLocation(source: AnyData): string | null {
  return source?.location ?? source?.city ?? source?.candidate_location ?? null;
}

function getFirstName(source: AnyData): string {
  if (source?.first_name) return String(source.first_name).trim();
  const full =
    source?.full_name ??
    source?.name ??
    source?.candidate_name ??
    source?.display_name ??
    "";
  const parts = String(full).trim().split(/\s+/).filter(Boolean);
  return parts[0] ?? "Candidato";
}

function getLastInitial(source: AnyData): string {
  if (source?.last_name) {
    return `${String(source.last_name).trim().charAt(0).toUpperCase()}.`;
  }
  const full =
    source?.full_name ??
    source?.name ??
    source?.candidate_name ??
    source?.display_name ??
    "";
  const parts = String(full).trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return "";
  return `${parts[1].charAt(0).toUpperCase()}.`;
}

function getDisplayName(source: AnyData): string {
  const first = getFirstName(source);
  const lastInitial = getLastInitial(source);
  return lastInitial ? `${first} ${lastInitial}` : first;
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
    null;

  if (!raw) return null;
  const text = String(raw).trim();
  if (!text) return null;
  return text;
}

export default function SharePublicCompactCard(props: AnyData) {
  const source = getSource(props);
  const experiences = getExperiences(source);
  const totalExperiences = experiences.length;
  const verifiedExperiences = countVerified(experiences);
  const trustScore = getTrustScore(source);
  const displayName = getDisplayName(source);
  const title = getTitle(source);
  const location = getLocation(source);
  const availability = getAvailability(source);

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex flex-col gap-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500 text-lg font-semibold text-white">
            {displayName
              .split(" ")
              .map((chunk) => chunk[0])
              .join("")
              .slice(0, 2)}
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
              Trust score
            </div>
            <div className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-slate-950">
              {trustScore ?? "—"}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-[14px] text-slate-600">
          Esta vista resumida no muestra detalle de experiencias, empresas, fechas ni timeline. Solo presenta señales agregadas.
        </div>
      </div>
    </div>
  );
}
