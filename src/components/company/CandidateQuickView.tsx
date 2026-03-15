"use client";

import {
  computeCandidateQuickFit,
  isCandidateVerified,
  resolveCandidateApproxLocation,
  resolveCandidateAvailableVerifications,
  resolveCandidatePartialName,
  resolveCandidatePipelineBucket,
  resolveCandidatePipelineLabel,
  resolveCandidateProfileReadiness,
  resolveCandidateSector,
  resolveCandidateYearsExperience,
  type CompanyCandidateWorkspaceRow,
} from "@/lib/company/candidate-fit";
import ProfileUnlockAction from "@/components/company/ProfileUnlockAction";

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function accessLabel(status: string | null | undefined) {
  const key = String(status || "").toLowerCase();
  if (key === "active") return "Perfil desbloqueado por tu empresa";
  if (key === "expired") return "Acceso expirado";
  return "Perfil parcial disponible";
}

function actionClass(primary = false) {
  return primary
    ? "inline-flex rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
    : "inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50";
}

export default function CandidateQuickView({
  row,
  open,
  onClose,
  onSetStage,
  actionLoading,
  availableProfileAccesses = 0,
}: {
  row: CompanyCandidateWorkspaceRow | null;
  open: boolean;
  onClose: () => void;
  onSetStage?: (inviteId: string, stage: "saved" | "preselected" | "none") => void;
  actionLoading?: string | null;
  availableProfileAccesses?: number;
}) {
  if (!open || !row) return null;

  const fit = computeCandidateQuickFit(row);
  const displayName = resolveCandidatePartialName(row);
  const pipeline = resolveCandidatePipelineBucket(row);
  const profileReadiness = resolveCandidateProfileReadiness(row);
  const verified = isCandidateVerified(row);
  const stage = String(row.company_stage || "none").toLowerCase();
  const canOpenSummary = Boolean(row.candidate_public_token);
  const accessActionLabel =
    row.access_status === "active"
      ? "Ver perfil completo"
      : row.access_status === "expired"
        ? "Acceder al perfil"
        : "Acceder al perfil";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35">
      <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vista rápida de candidato</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">{displayName}</h2>
              <p className="mt-2 text-sm text-slate-600">Perfil parcial para decidir si merece la pena desbloquear el perfil completo.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Cerrar
            </button>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6">
          <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${fit.tone}`} title={fit.reasons.join(" · ")}>
                {fit.label}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                {resolveCandidatePipelineLabel(pipeline)}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                {accessLabel(row.access_status)}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-700">{fit.summary}</p>
            <p className="mt-2 text-xs text-slate-500">
              El encaje rápido se apoya en trust score, verificaciones registradas, preparación del perfil y momento real del pipeline.
            </p>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">Accesos a perfiles disponibles: {availableProfileAccesses}</p>
              {availableProfileAccesses <= 0 && row.access_status !== "active" ? (
                <p className="mt-1 text-sm text-rose-700">No tienes accesos disponibles para ver perfiles completos.</p>
              ) : null}
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Sector</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{resolveCandidateSector(row)}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Experiencia</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{resolveCandidateYearsExperience(row)}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Ubicación aproximada</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{resolveCandidateApproxLocation(row)}</p>
            </article>
          </section>

          <section className="grid gap-3 md:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Trust score</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{row.trust_score ?? "—"}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Verificaciones disponibles</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{resolveCandidateAvailableVerifications(row)}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Perfil</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{profileReadiness === "complete" ? "Listo" : "Incompleto"}</p>
            </article>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <article className="rounded-3xl border border-slate-200 bg-white p-5">
              <h3 className="text-base font-semibold text-slate-900">Resumen parcial del candidato</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>• Estado del pipeline: {resolveCandidatePipelineLabel(pipeline)}</li>
                <li>• Perfil verificable: {profileReadiness === "complete" ? "sí" : "todavía no"}</li>
                <li>• Estado verificado: {verified ? "con señales verificadas" : "sin validación aprobada todavía"}</li>
                <li>• Verificaciones disponibles: {resolveCandidateAvailableVerifications(row)}</li>
                <li>• Última actividad: {formatDate(row.last_activity_at || row.created_at)}</li>
              </ul>
            </article>
            <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-base font-semibold text-slate-900">Qué hacer ahora</h3>
              <p className="mt-2 text-sm text-slate-600">
                Usa esta vista para decidir si merece la pena acceder al perfil completo o seguir moviendo el candidato dentro del pipeline interno.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {canOpenSummary ? (
                  <a href={`/company/candidate/${encodeURIComponent(String(row.candidate_public_token))}`} className={actionClass()}>
                    Ver resumen completo
                  </a>
                ) : (
                  <span className={`${actionClass()} cursor-not-allowed opacity-50`}>Ver resumen completo</span>
                )}
                {canOpenSummary ? (
                  <ProfileUnlockAction
                    href={`/company/candidate/${encodeURIComponent(String(row.candidate_public_token))}?view=full`}
                    availableAccesses={availableProfileAccesses}
                    alreadyUnlocked={row.access_status === "active"}
                    primaryLabel={accessActionLabel}
                  />
                ) : (
                  <span className={`${actionClass(true)} cursor-not-allowed opacity-50`}>Acceder al perfil</span>
                )}
                <button
                  type="button"
                  onClick={() => onSetStage?.(row.id, stage === "saved" ? "none" : "saved")}
                  disabled={!onSetStage || actionLoading === row.id}
                  className={`${actionClass()} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {stage === "saved" ? "Quitar guardado" : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => onSetStage?.(row.id, stage === "preselected" ? "none" : "preselected")}
                  disabled={!onSetStage || actionLoading === row.id}
                  className={`${actionClass(true)} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {stage === "preselected" ? "Quitar preselección" : "Preseleccionar"}
                </button>
                <span className={`${actionClass()} cursor-not-allowed opacity-50`}>Archivar</span>
              </div>
              {row.access_status === "active" ? (
                <p className="mt-4 text-sm font-medium text-emerald-700">Perfil desbloqueado por tu empresa.</p>
              ) : (
                <p className="mt-4 text-sm text-slate-600">
                  Acceder al perfil completo consumirá 1 acceso y quedará desbloqueado permanentemente para tu empresa.
                </p>
              )}
            </article>
          </section>
        </div>
      </div>
    </div>
  );
}
