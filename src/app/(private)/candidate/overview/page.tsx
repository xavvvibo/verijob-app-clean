"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/browser";
import { VerificationBadge } from "@/components/brand/VerificationBadge";
import CandidatePresentationLayout from "@/components/candidate-v2/layouts/CandidatePresentationLayout";
import OverviewHero from "@/components/candidate-v2/overview/OverviewHero";
import OverviewHighlights from "@/components/candidate-v2/overview/OverviewHighlights";
import OverviewProgressSection from "@/components/candidate-v2/overview/OverviewProgressSection";
import OverviewExperiencesPreview from "@/components/candidate-v2/overview/OverviewExperiencesPreview";
import OverviewProfilePublicCard from "@/components/candidate-v2/overview/OverviewProfilePublicCard";
import OverviewUpgradeCard from "@/components/candidate-v2/overview/OverviewUpgradeCard";
import CandidateSurface from "@/components/candidate-v2/primitives/CandidateSurface";
import TrustScoreRing from "@/components/candidate/TrustScoreRing";
import { summarizeCompanyCvImportUpdates } from "@/lib/candidate/import-update-summary";
import { mapCandidateAvailability } from "@/lib/candidate/availability";
import {
  computeCandidateOverviewMetrics,
  resolveCandidateOverviewStatus,
} from "@/lib/candidate/overview-metrics";
import { getCandidatePlanCapabilities } from "@/lib/billing/planCapabilities";
import {
  resolvePublicCandidateDisplayName,
  resolvePublicProfileDisplaySummary,
} from "@/lib/public/candidate-profile-display";

type ProfileLite = {
  full_name?: string | null;
  title?: string | null;
  location?: string | null;
  avatar_url?: string | null;
};

type CandidateProfilePayload = Record<string, any> | null;

type ProfileCompletionItem = {
  id: string;
  label: string;
  status: "completed" | "pending";
  completed: boolean;
};

type ProfileCompletionPayload = {
  score?: number | null;
  completed?: number | null;
  total?: number | null;
  checklist?: ProfileCompletionItem[] | null;
} | null;

type VerificationRow = {
  status: string | null;
  company_confirmed: boolean | null;
  evidence_count: number | null;
};

type EmploymentRecordLite = {
  verification_status: string | null;
};

type TrustState = {
  title: string;
  summary: string;
  tone: string;
};

type ExperienceImpact = {
  label: string;
  tone: string;
};

type SignalTone = "blue" | "green" | "amber" | "rose" | "violet";

type SubscriptionStatePayload = {
  subscription?: {
    plan?: string | null;
  } | null;
};

type PublicProfilePreviewPayload = Record<string, any> | null;

const PUBLIC_PROFILE_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "https://app.verijob.es";

function clamp(n: number, a = 0, b = 100) {
  return Math.max(a, Math.min(b, n));
}

function resolveTrustState(args: {
  verified: number;
  inProcess: number;
  evidences: number;
  profileCompletionScore: number;
}) : TrustState {
  if (args.verified >= 2 || (args.verified >= 1 && args.evidences >= 1) || args.profileCompletionScore >= 85) {
    return {
      title: "Alta confianza",
      summary: "Tu perfil ya transmite señales sólidas y verificables. Añadir una prueba más puede reforzarlo todavía más.",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
    };
  }
  if (args.verified >= 1 || args.inProcess >= 1 || args.evidences >= 1 || args.profileCompletionScore >= 55) {
    return {
      title: "Confianza media",
      summary: "Tu perfil ya transmite señales reales de credibilidad. Añadir evidencias o completar verificaciones puede reforzarlo aún más.",
      tone: "border-blue-200 bg-blue-50 text-blue-900",
    };
  }
  return {
    title: "Perfil en progreso",
    summary: "Tu perfil ya está en marcha. La siguiente mejor acción es completar una experiencia o activar tu primera verificación.",
    tone: "border-amber-200 bg-amber-50 text-amber-900",
  };
}

function signalToneClasses(tone: SignalTone) {
  if (tone === "green") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-800";
  if (tone === "rose") return "border-rose-200 bg-rose-50 text-rose-800";
  if (tone === "violet") return "border-violet-200 bg-violet-50 text-violet-800";
  return "border-blue-200 bg-blue-50 text-blue-800";
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

function formatTimelineDate(value?: string | null) {
  return formatMonthYear(value) || (value ? String(value) : "");
}

function resolveCandidateNameFallback(rawCvJson: unknown) {
  const raw = rawCvJson && typeof rawCvJson === "object" ? (rawCvJson as Record<string, any>) : {};
  const updates = Array.isArray(raw.company_cv_import_updates) ? raw.company_cv_import_updates : [];
  for (const entry of updates) {
    const proposal = entry && typeof entry === "object" ? (entry as any).profile_proposal : null;
    const nextName = String(proposal?.full_name || "").trim();
    if (nextName) return nextName;
  }

  const companyImportName = String(raw?.company_cv_import?.candidate_identity?.display_name || raw?.company_cv_import?.candidate_identity?.reliable_name || "").trim();
  if (companyImportName) return companyImportName;

  const extractedName = String(raw?.company_cv_import?.extracted_payload?.full_name || "").trim();
  return extractedName || null;
}

function buildPreparationSegments(args: {
  profileCompletionScore: number;
  experienceCount: number;
  verified: number;
  inProcess: number;
  evidences: number;
  publicProfileActive: boolean;
}) {
  return [
    {
      id: "base",
      label: "Base",
      status: args.profileCompletionScore >= 70 ? "done" : args.profileCompletionScore >= 35 ? "progress" : "pending",
    },
    {
      id: "experience",
      label: "Experiencias",
      status: args.experienceCount > 0 ? "done" : "pending",
    },
    {
      id: "verification",
      label: "Verificaciones",
      status: args.verified > 0 ? "done" : args.inProcess > 0 ? "progress" : "pending",
    },
    {
      id: "evidence",
      label: "Evidencias",
      status: args.evidences > 0 ? "done" : "pending",
    },
    {
      id: "visibility",
      label: "Visibilidad",
      status: args.publicProfileActive ? "done" : "pending",
    },
  ] as const;
}

function buildHighlightCards(args: {
  metrics: ReturnType<typeof computeCandidateOverviewMetrics>;
  profileCompletionScore: number;
  experienceCount: number;
}) {
  return [
    {
      title: "Haz que tu experiencia pese más",
      body: "Sin evidencia, parte de tu valor sigue siendo declarativo.",
      cta: "Subir evidencia",
      href: "/candidate/evidence",
      tone: "border-blue-200 bg-blue-50/70",
      status: args.metrics.evidences > 0 ? `${args.metrics.evidences} evidencia${args.metrics.evidences === 1 ? "" : "s"} subida${args.metrics.evidences === 1 ? "" : "s"}` : "Sin evidencias",
    },
    {
      title: "Convierte experiencia en señal verificable",
      body: "Una verificación puede marcar la diferencia.",
      cta: args.metrics.inProcess > 0 ? "Revisar verificación" : "Solicitar verificación",
      href: "/candidate/verifications",
      tone: "border-emerald-200 bg-emerald-50/70",
      status: args.metrics.verified > 0 ? `${args.metrics.verified} verificada${args.metrics.verified === 1 ? "" : "s"}` : args.metrics.inProcess > 0 ? `${args.metrics.inProcess} en curso` : "Sin validar",
    },
    {
      title: "Evita un perfil a medias",
      body: "Los perfiles incompletos pierden fuerza.",
      cta: "Completar perfil",
      href: "/candidate/profile",
      tone: "border-amber-200 bg-amber-50/70",
      status: args.profileCompletionScore >= 70 ? "Base sólida" : `${Math.round(args.profileCompletionScore)}% completado`,
    },
  ] as const;
}

function buildOpportunityCard(args: {
  metrics: ReturnType<typeof computeCandidateOverviewMetrics>;
  profileCompletionScore: number;
  publicProfileActive: boolean;
  identityIncomplete?: boolean;
}) {
  if (args.identityIncomplete) {
    return {
      title: "Tu perfil necesita una base más clara para transmitir confianza",
      body: "Completar nombre, titular y ubicación mejora cómo te verán las empresas antes incluso de revisar tus verificaciones.",
      href: "/candidate/profile",
      cta: "Completa tu perfil",
      tone: "border-blue-200 bg-blue-50/90",
    };
  }

  if (args.metrics.evidences === 0 && (args.metrics.verified > 0 || args.metrics.inProcess > 0)) {
    return {
      title: "Te faltan evidencias para destacar frente a otros candidatos",
      body: "Sin soporte documental, parte de tu valor sigue dependiendo solo de lo declarado.",
      href: "/candidate/evidence",
      cta: "Sube una evidencia",
      tone: "border-rose-200 bg-rose-50/90",
    };
  }

  if (args.metrics.inProcess > 0) {
    return {
      title: "Tienes una verificación en curso que puede subir tu credibilidad",
      body: "Cerrar este paso puede convertir señal parcial en confianza real para empresa.",
      href: "/candidate/verifications",
      cta: "Revisa tu verificación",
      tone: "border-amber-200 bg-amber-50/90",
    };
  }

  if (args.profileCompletionScore < 70) {
    return {
      title: "Tu perfil aún depende demasiado de información declarada",
      body: "Completar mejor tu base reduce dudas antes incluso de verificar nada.",
      href: "/candidate/profile",
      cta: "Completa tu perfil",
      tone: "border-blue-200 bg-blue-50/90",
    };
  }

  if (!args.publicProfileActive) {
    return {
      title: "Tu perfil público aún no muestra toda tu fuerza",
      body: "Convertir tu perfil en una pieza compartible mejora cómo te ven fuera de VERIJOB.",
      href: "/candidate/share",
      cta: "Revisa tu perfil público",
      tone: "border-violet-200 bg-violet-50/90",
    };
  }

  return {
    title: "Tu perfil ya transmite confianza, pero aún puedes empujarlo más",
    body: "Una mejora visible más puede ayudarte a destacar mejor frente a perfiles menos reforzados.",
    href: "/candidate/verifications",
    cta: "Refuerza tu perfil hoy",
    tone: "border-emerald-200 bg-emerald-50/90",
  };
}

function resolveExperienceValueCopy(item: any) {
  if (item?.status_label?.toLowerCase().includes("verificada")) {
    return "Esta experiencia ya aporta credibilidad real a tu perfil.";
  }
  if (item?.status_label?.toLowerCase().includes("proceso") || item?.status_label?.toLowerCase().includes("curso")) {
    return "Esta experiencia ya está generando señal, pero todavía necesita confirmación.";
  }
  if (item?.support_label) {
    return "Podrías reforzarla con documentación o con una solicitud bien dirigida.";
  }
  return "Todavía no genera una señal fuerte. Puedes reforzarla con documentación o verificación.";
}

function resolveExperienceCardCta(item: any) {
  if (item?.status_label?.toLowerCase().includes("verificada")) {
    return { label: "Ver verificaciones", href: "/candidate/verifications" };
  }
  if (item?.status_label?.toLowerCase().includes("proceso") || item?.status_label?.toLowerCase().includes("curso")) {
    return { label: "Revisar estado", href: "/candidate/verifications" };
  }
  return { label: "Reforzar experiencia", href: "/candidate/evidence" };
}

function resolveExperienceImpact(item: any): ExperienceImpact {
  if (item?.status_label?.toLowerCase().includes("verificada")) {
    return {
      label: "Impacto en tu perfil: alto",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
    };
  }
  if (item?.status_label?.toLowerCase().includes("proceso") || item?.status_label?.toLowerCase().includes("curso")) {
    return {
      label: "Impacto en tu perfil: medio",
      tone: "border-amber-200 bg-amber-50 text-amber-900",
    };
  }
  return {
    label: "Impacto en tu perfil: bajo",
    tone: "border-slate-200 bg-slate-50 text-slate-700",
  };
}

function AvatarView({
  fullName,
  avatarUrl,
  onAvatarSaved,
}: {
  fullName?: string | null;
  avatarUrl?: string | null;
  onAvatarSaved: (next: string | null) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function uploadAvatar(file: File) {
    setSaving(true);
    setError(null);
    try {
      const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
      if (!allowed.has(file.type)) {
        throw new Error("Formato no permitido. Usa JPG, PNG o WEBP.");
      }
      if (file.size <= 0 || file.size > 4 * 1024 * 1024) {
        throw new Error("La imagen debe pesar menos de 4MB.");
      }

      const localPreview = URL.createObjectURL(file);
      setPreviewUrl(localPreview);

      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/candidate/avatar", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.details || data?.error || "No se pudo subir la foto.");

      const next = String(data?.avatar_url || "").trim();
      if (!next) throw new Error("No se pudo guardar la foto.");
      onAvatarSaved(next);
      setPreviewUrl(null);
    } catch (e: any) {
      setError(e?.message || "No se pudo actualizar la foto de perfil.");
      setPreviewUrl(null);
    } finally {
      setSaving(false);
    }
  }

  async function removeAvatar() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/candidate/avatar", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.details || data?.error || "No se pudo quitar la foto.");
      onAvatarSaved(null);
      setPreviewUrl(null);
    } catch (e: any) {
      setError(e?.message || "No se pudo quitar la foto.");
    } finally {
      setSaving(false);
    }
  }

  const finalAvatarUrl = previewUrl || avatarUrl || null;
  const fallback = (fullName || "C")
    .trim()
    .split(/\s+/)
    .map((x) => x[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "C";

  return (
    <div>
      <div className="relative h-32 w-32 sm:h-36 sm:w-36">
        {finalAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={finalAvatarUrl} alt={fullName || "Avatar"} className="h-32 w-32 rounded-[30px] border border-white/70 object-cover shadow-md sm:h-36 sm:w-36" />
        ) : (
          <div className="flex h-32 w-32 items-center justify-center rounded-[30px] border border-white/70 bg-white text-3xl font-semibold text-slate-700 shadow-md sm:h-36 sm:w-36 sm:text-[2.2rem]">
            {fallback}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          void uploadAvatar(file);
          e.currentTarget.value = "";
        }}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={saving}
          className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black disabled:opacity-60"
        >
          {saving ? "Subiendo…" : "Actualizar foto"}
        </button>
        {avatarUrl ? (
          <button
            type="button"
            onClick={() => void removeAvatar()}
            disabled={saving}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
          >
            Quitar
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-slate-500">JPG, PNG o WEBP. Máximo 4MB.</p>
      {error ? <div className="mt-2 text-xs text-red-600">{error}</div> : null}
    </div>
  );
}

function TrustRing({ score, stateTitle }: { score: number; stateTitle: string }) {
  return <TrustScoreRing score={score} stateTitle={stateTitle} label="Trust score" size="hero" className="scale-[1.08] sm:scale-[1.1]" />;
}

function InsightCard({
  title,
  body,
  cta,
  href,
  tone,
  status,
  emphasis = "subtle",
}: {
  title: string;
  body: string;
  cta: string;
  href: string;
  tone: string;
  status?: string;
  emphasis?: "primary" | "subtle";
}) {
  const buttonClass =
    emphasis === "primary"
      ? "mt-5 inline-flex rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-[1px] hover:bg-black hover:shadow-sm"
      : "mt-4 inline-flex rounded-lg border border-slate-200 bg-white/80 px-3.5 py-2 text-xs font-semibold text-slate-900 transition-all duration-150 hover:-translate-y-[1px] hover:bg-slate-50 hover:shadow-sm";
  return (
    <article className={`rounded-2xl p-5 transition-all duration-150 hover:-translate-y-[1px] hover:shadow-sm ${tone}`}>
      {status ? <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{status}</p> : null}
      <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
      <Link href={href} className={buttonClass}>
        {cta}
      </Link>
    </article>
  );
}

function SemanticProgressBar({
  segments,
}: {
  segments: ReadonlyArray<{ id: string; label: string; status: "done" | "progress" | "pending" }>;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-2">
        {segments.map((segment) => {
          const tone =
            segment.status === "done"
              ? "bg-emerald-500"
              : segment.status === "progress"
                ? "bg-amber-400"
                : "bg-slate-200";
          return <div key={segment.id} className={`h-3 rounded-full ${tone}`} />;
        })}
      </div>
      <div className="grid gap-2 sm:grid-cols-5">
        {segments.map((segment) => (
          <div key={segment.id} className="rounded-xl bg-white/75 px-3 py-2 ring-1 ring-slate-200/70">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{segment.label}</p>
            <p className="mt-1 text-xs font-medium text-slate-700">
              {segment.status === "done" ? "Listo" : segment.status === "progress" ? "En curso" : "Pendiente"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SnapshotItem({
  label,
  value,
  hint,
  tone = "blue",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: SignalTone;
}) {
  return (
    <div className="rounded-2xl bg-white/80 px-4 py-3 ring-1 ring-slate-200/70">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-950">{label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold text-slate-950">{value}</p>
          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${signalToneClasses(tone)}`}>
            {tone === "green" ? "Fuerte" : tone === "amber" ? "Mejorable" : tone === "rose" ? "Pendiente" : tone === "violet" ? "Visible" : "Activo"}
          </span>
        </div>
      </div>
    </div>
  );
}

function ExperienceSummaryCard({ item }: { item: any }) {
  const cta = resolveExperienceCardCta(item);
  const impact = resolveExperienceImpact(item);
  const statusDot =
    item?.status_label?.toLowerCase().includes("verificada")
      ? "bg-emerald-500"
      : item?.status_label?.toLowerCase().includes("proceso") || item?.status_label?.toLowerCase().includes("curso")
        ? "bg-amber-500"
        : "bg-slate-300";

  return (
    <article className="border-b border-slate-100 pb-7 pt-7 transition-colors duration-150 hover:bg-slate-50/50 last:border-b-0">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${statusDot}`} />
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-slate-950">{item.role_title || "Experiencia profesional"}</h3>
              <p className="mt-1 text-sm text-slate-500">{item.company_name || "Empresa no definida"}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                {formatTimelineDate(item.start_date) || "Inicio no definido"} · {item.end_date ? formatTimelineDate(item.end_date) : "Actualidad"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:max-w-[320px] lg:justify-end">
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${item.status_tone}`}>{item.status_label}</span>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${impact.tone}`}>{impact.label}</span>
          {item.support_label ? (
            <span className="rounded-full border border-blue-200/90 px-3 py-1 text-xs font-semibold text-blue-800">
              {item.support_label}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-slate-500">{resolveExperienceValueCopy(item)}</p>
        <Link href={cta.href} className="inline-flex rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50">
          {cta.label}
        </Link>
      </div>
    </article>
  );
}

function PublicProfileCard({
  publicLink,
  preview,
  trustScore,
  verified,
  visibilityLabel,
}: {
  publicLink: string | null;
  preview: PublicProfilePreviewPayload;
  trustScore: number;
  verified: number;
  visibilityLabel: string;
}) {
  const publicDisplayName = resolvePublicCandidateDisplayName(preview);
  const displaySummary = resolvePublicProfileDisplaySummary(preview);
  const publicLanguagesLabel = displaySummary.languagesLabel;
  const capabilityLabel = displaySummary.capabilitiesLabel;
  return (
    <section className="rounded-[28px] bg-slate-50/90 p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_12px_30px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/70">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Cómo te verá una empresa</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">Perfil público verificable</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Tu versión pública y compartible, preparada para generar confianza sin exponer datos sensibles.</p>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Vista real de evaluación</div>
          <div className="mt-2 text-base font-semibold text-slate-900">{visibilityLabel}</div>
          <div className="text-xs text-slate-600">{verified} verificaciones visibles</div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
        <div className="rounded-2xl bg-white/80 p-5 ring-1 ring-slate-200/70">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-200/80 px-3 py-1 text-xs font-semibold text-slate-700">
              Nivel de confianza {Math.round(trustScore)}
            </span>
            <span className="rounded-full border border-slate-200/80 px-3 py-1 text-xs font-semibold text-slate-700">
              {preview?.teaser?.verified_experiences ?? verified} experiencias verificadas
            </span>
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-900">
            {publicDisplayName}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {[preview?.teaser?.title, preview?.teaser?.location].filter(Boolean).join(" · ") || "Resumen profesional visible para empresa"}
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <span className="rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
              Formación: {displaySummary.educationCount > 0 ? `${displaySummary.educationCount} entradas` : "Formacion pendiente"}
            </span>
            <span className="rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
              Idiomas: {publicLanguagesLabel}
            </span>
            <span className="rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 sm:col-span-2">
              {capabilityLabel}
            </span>
          </div>
        </div>

        <div className="rounded-2xl bg-white/80 p-5 ring-1 ring-slate-200/70">
          <p className="text-sm font-semibold text-slate-900">Compartir y revisar</p>
          <div className="mt-4 flex flex-col gap-3">
            <Link href="/candidate/share" className="inline-flex justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black">
              Ver perfil público
            </Link>
            <Link href="/candidate/share" className="inline-flex justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50">
              Compartir perfil
            </Link>
          </div>
          <p className="mt-4 break-all text-xs text-slate-500">{publicLink || "Activa tu enlace público para compartir tu perfil verificable."}</p>
        </div>
      </div>
    </section>
  );
}

function UpgradeCard({
  planLabel,
  summary,
}: {
  planLabel: string;
  summary: string;
}) {
  return (
    <section className="rounded-[28px] bg-gradient-to-r from-indigo-50/70 to-purple-50/60 p-7 shadow-[0_14px_36px_rgba(99,102,241,0.08)] ring-1 ring-indigo-100/70">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-700">Multiplica tu impacto</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">Más visibilidad, mejor presentación y un perfil más sólido</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">Convierte tu trayectoria en una versión más visible y más convincente cuando la compartes.</p>
        </div>
        <div className="min-w-[260px]">
          <p className="text-sm font-semibold text-slate-900">Tu plan actual: {planLabel}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{summary}</p>
          <Link href="/candidate/subscription" className="mt-4 inline-flex w-full justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-black">
            Mejorar plan
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function CandidateOverview() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfilePayload>(null);
  const [profileCompletion, setProfileCompletion] = useState<ProfileCompletionPayload>(null);
  const [verifications, setVerifications] = useState<VerificationRow[]>([]);
  const [employmentRecords, setEmploymentRecords] = useState<EmploymentRecordLite[]>([]);
  const [trustScore, setTrustScore] = useState<number | null>(null);
  const [experienceCount, setExperienceCount] = useState<number>(0);
  const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(null);
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [publicPreview, setPublicPreview] = useState<PublicProfilePreviewPayload>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const supabase = createClient();
        const { data: au, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;
        if (!au?.user?.id) {
          window.location.href = "/login";
          return;
        }

        const userId = au.user.id;

        const [profileRes, verificationsRes, employmentRes, profileApiRes, trustRes, subscriptionRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("full_name, title, location, avatar_url")
            .eq("id", userId)
            .maybeSingle(),
          supabase
            .from("verification_summary")
            .select("status, company_confirmed, evidence_count")
            .eq("candidate_id", userId),
          supabase
            .from("employment_records")
            .select("verification_status")
            .eq("candidate_id", userId),
          fetch("/api/candidate/profile", { credentials: "include" }).then((r) => r.json().catch(() => ({}))),
          fetch("/api/candidate/trust-score", { credentials: "include" }).then((r) => r.json().catch(() => ({}))),
          fetch("/api/account/subscription-state", { credentials: "include", cache: "no-store" }).then((r) =>
            r.json().catch(() => ({})) as Promise<SubscriptionStatePayload>
          ),
        ]);

        if (profileRes.error) throw profileRes.error;
        if (verificationsRes.error) throw verificationsRes.error;

        if (!alive) return;

        setProfile((profileRes.data || null) as ProfileLite | null);
        setVerifications((verificationsRes.data || []) as VerificationRow[]);
        setEmploymentRecords((employmentRes.data || []) as EmploymentRecordLite[]);
        setCandidateProfile(profileApiRes?.profile ?? null);
        setProfileCompletion((profileApiRes?.profile_completion || null) as ProfileCompletionPayload);
        let nextTrustScore = typeof trustRes?.trust_score === "number" ? trustRes.trust_score : null;
        const hasVerifiedEmployment = Array.isArray(employmentRes.data)
          ? employmentRes.data.some((row: any) => {
              const status = String(row?.verification_status || "").trim().toLowerCase();
              return status === "verified" || status === "approved" || status === "verified_document" || status === "verified_paid";
            })
          : false;
        if ((nextTrustScore == null || Number(nextTrustScore) <= 0) && hasVerifiedEmployment) {
          const trustRefreshRes = await fetch("/api/candidate/trust-score", {
            method: "POST",
            credentials: "include",
            cache: "no-store",
          }).then((r) => r.json().catch(() => ({})));
          if (typeof trustRefreshRes?.trust_score === "number") {
            nextTrustScore = trustRefreshRes.trust_score;
          }
        }
        setTrustScore(nextTrustScore);
        setExperienceCount(Number(profileApiRes?.counts?.experience_count || 0));
        setSubscriptionPlan(subscriptionRes?.subscription?.plan || null);
        setError(null);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "No se pudo cargar el dashboard");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const linkRes = await fetch("/api/candidate/public-link", {
          method: "POST",
          credentials: "include",
        });
        const linkBody = await linkRes.json().catch(() => ({}));
        if (!linkRes.ok || !linkBody?.token) return;

        const nextToken = String(linkBody.token || "").trim();
        if (!nextToken) return;
        if (!alive) return;
        setPublicToken(nextToken);

        const previewRes = await fetch(`/api/public/candidate/${encodeURIComponent(nextToken)}?scope=internal`, {
          credentials: "include",
          cache: "no-store",
        });
        const previewBody = await previewRes.json().catch(() => ({}));
        if (!previewRes.ok || !alive) return;
        setPublicPreview(previewBody || null);
      } catch {
        if (!alive) return;
        setPublicToken(null);
        setPublicPreview(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const metrics = useMemo(
    () =>
      computeCandidateOverviewMetrics({
        verifications,
        employmentRecords,
        experienceCount,
        trustScore,
      }),
    [employmentRecords, experienceCount, trustScore, verifications]
  );

  const companyCvImportSummary = useMemo(
    () => summarizeCompanyCvImportUpdates(candidateProfile?.raw_cv_json),
    [candidateProfile]
  );
  const importedFromCompanyCv =
    searchParams.get("company_cv_import") === "1" || companyCvImportSummary.importedFromCompanyCv || companyCvImportSummary.updatesCount > 0;
  const importedExperiences = useMemo(() => {
    const rows = Array.isArray(candidateProfile?.raw_cv_json?.company_cv_import?.extracted_payload?.experiences)
      ? candidateProfile.raw_cv_json.company_cv_import.extracted_payload.experiences
      : [];
    return rows.slice(0, 6);
  }, [candidateProfile]);
  const companyCvPendingUpdates = companyCvImportSummary.totalPendingItems;
  const experienceTimeline = Array.isArray(candidateProfile?.experience_timeline)
    ? candidateProfile.experience_timeline.slice(0, 3)
    : [];

  const profileCompletionScore = Number(profileCompletion?.score || 0);
  const profileStage = useMemo(() => {
    if (profileCompletionScore >= 85) return "Listo para empresas";
    if (profileCompletionScore >= 55) return "Perfil en progreso";
    return "Perfil inicial";
  }, [profileCompletionScore]);

  const overviewStatus = useMemo(
    () => resolveCandidateOverviewStatus({ experienceCount, metrics }),
    [experienceCount, metrics]
  );

  const trustState = useMemo(
    () =>
      resolveTrustState({
        verified: metrics.verified,
        inProcess: metrics.inProcess,
        evidences: metrics.evidences,
        profileCompletionScore,
      }),
    [metrics.evidences, metrics.inProcess, metrics.verified, profileCompletionScore]
  );

  const highlightCards = useMemo(
    () =>
      buildHighlightCards({
        metrics,
        profileCompletionScore,
        experienceCount,
      }),
    [experienceCount, metrics, profileCompletionScore]
  );

  const availabilityText = useMemo(
    () => mapCandidateAvailability(candidateProfile?.job_search_status) || "Disponibilidad no definida",
    [candidateProfile?.job_search_status]
  );

  const planCapabilities = useMemo(() => getCandidatePlanCapabilities(subscriptionPlan), [subscriptionPlan]);
  const showUpgrade = planCapabilities.plan === "free" || planCapabilities.plan === "starter";
  const publicLink = publicToken ? `${PUBLIC_PROFILE_ORIGIN}/p/${publicToken}` : null;
  const publicLanguages = Array.isArray(publicPreview?.teaser?.languages) ? publicPreview?.teaser?.languages : [];
  const educationCount = Number(publicPreview?.teaser?.education_total ?? 0);
  const achievementsCount = Number(publicPreview?.teaser?.achievements_total ?? 0);
  const displayName = profile?.full_name || resolveCandidateNameFallback(candidateProfile?.raw_cv_json) || null;
  const identityFieldsMissing = {
    fullName: !String(profile?.full_name || "").trim(),
    title: !String(profile?.title || "").trim(),
    location: !String(profile?.location || "").trim(),
  };
  const identityIncomplete = identityFieldsMissing.fullName || identityFieldsMissing.title || identityFieldsMissing.location;
  const verifiedSkillsCount = Array.isArray(publicPreview?.verified_skills) ? publicPreview?.verified_skills.length : 0;
  const publicProfileActive = Boolean(publicToken);
  const publicVisibilityLabel =
    publicPreview?.teaser?.profile_visibility ||
    candidateProfile?.public_profile_settings?.experienceVisibility?.length
      ? "Perfil compartible"
      : "Vista pública limitada";
  const preparationSegments = useMemo(
    () =>
      buildPreparationSegments({
        profileCompletionScore,
        experienceCount,
        verified: metrics.verified,
        inProcess: metrics.inProcess,
        evidences: metrics.evidences,
        publicProfileActive,
      }),
    [experienceCount, metrics.evidences, metrics.inProcess, metrics.verified, profileCompletionScore, publicProfileActive]
  );
  const opportunityCard = useMemo(
    () =>
      buildOpportunityCard({
        metrics,
        profileCompletionScore,
        publicProfileActive,
        identityIncomplete,
      }),
    [identityIncomplete, metrics, profileCompletionScore, publicProfileActive]
  );

  return (
    <CandidatePresentationLayout>
      {importedFromCompanyCv ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <p className="text-sm font-semibold text-amber-900">Perfil pre-rellenado desde un CV subido por empresa</p>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            Hemos importado información preliminar desde el CV que una empresa incorporó a su proceso. Revísala, corrígela si hace falta y completa tu perfil antes de publicarlo o verificarlo.
          </p>
          {importedExperiences.length ? (
            <div className="mt-4 rounded-2xl border border-amber-300 bg-white p-4">
              <p className="text-sm font-semibold text-amber-950">Hemos detectado estas experiencias en tu CV</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {importedExperiences.map((item: any, index: number) => (
                  <li key={`${item?.company_name || "exp"}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="font-semibold text-slate-900">{item?.role_title || "Experiencia detectada"}</p>
                    <p className="mt-1 text-slate-600">{item?.company_name || "Empresa"}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatPeriod(item?.start_date || null, item?.end_date || null)}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {companyCvPendingUpdates > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-900">
                Cambios pendientes: {companyCvPendingUpdates}
              </span>
              <Link href="/candidate/import-updates" className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black">
                Revisar y actualizar mi perfil
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      <OverviewHero
        left={
          <div className="min-w-0">
            <div className="flex items-start gap-4 sm:gap-5 xl:gap-6 2xl:gap-7">
              <AvatarView
                fullName={displayName}
                avatarUrl={profile?.avatar_url}
                onAvatarSaved={(next) => setProfile((prev) => ({ ...(prev || {}), avatar_url: next }))}
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Perfil evaluable</p>
                <p className="mt-3 text-[2.15rem] font-semibold tracking-tight text-slate-950 sm:text-[3rem]">{displayName || "Tu perfil verificable"}</p>
                <p className="mt-2 text-[1.05rem] font-medium text-slate-800">{profile?.title || "Profesional verificable en Verijob"}</p>
                <p className="mt-1 text-sm text-slate-500">{profile?.location || "Ubicación no definida"}</p>
                {identityIncomplete ? (
                  <div className="mt-4 max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                    <p className="font-semibold">Completa tu perfil básico</p>
                    <p className="mt-1 leading-6 text-amber-800">
                      {experienceCount > 0
                        ? "Ya tienes experiencia en el perfil. Completar nombre, titular y ubicación mejora cómo te verán las empresas."
                        : "Completar nombre, titular y ubicación hace que tu perfil se entienda mejor desde el primer vistazo."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href="/candidate/profile" className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black">
                        Completa tu perfil
                      </Link>
                      {identityFieldsMissing.fullName && displayName ? (
                        <span className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-900">
                          Nombre detectado: {displayName}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="mt-7 max-w-[46rem] rounded-[32px] border border-indigo-100/90 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(239,246,255,0.88),rgba(224,231,255,0.88))] p-5 shadow-[0_24px_56px_rgba(15,23,42,0.1)] backdrop-blur-sm sm:p-6">
                  <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-7 xl:gap-9">
                    <TrustRing score={metrics.score} stateTitle={trustState.title} />
                    <div className="min-w-0 max-w-[31rem]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Fortaleza del perfil</p>
                      <p className="mt-2 text-lg font-semibold leading-8 text-slate-950">
                        {metrics.score >= 60
                          ? "Tu perfil ya transmite señales reales y verificables."
                          : "Tu perfil ya es legible, pero todavía le faltan pruebas para imponer confianza."}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {metrics.verified > 0
                          ? `Ya tienes ${metrics.verified} experiencia${metrics.verified === 1 ? "" : "s"} verificada${metrics.verified === 1 ? "" : "s"} y esa señal ya empuja tu trust score global.`
                          : "La forma más rápida de subir este bloque es combinar experiencia verificada y evidencia documental."}
                      </p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Trust actual</p>
                          <p className="mt-1 text-lg font-semibold text-slate-950">{metrics.score}/100</p>
                        </div>
                        <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Verificadas</p>
                          <p className="mt-1 text-lg font-semibold text-slate-950">{metrics.verified}</p>
                        </div>
                        <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">En progreso</p>
                          <p className="mt-1 text-lg font-semibold text-slate-950">{metrics.inProcess}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <VerificationBadge tone={metrics.verified > 0 ? "company_verified" : metrics.inProcess > 0 ? "in_progress" : "trust_visible"}>
                    {trustState.title}
                  </VerificationBadge>
                  <VerificationBadge tone={profileCompletionScore >= 70 ? "company_verified" : "in_progress"}>
                    {profileStage}
                  </VerificationBadge>
                  <VerificationBadge tone={publicProfileActive ? "trust_visible" : "in_progress"}>
                    {publicProfileActive ? "Perfil público activo" : "Perfil público mejorable"}
                  </VerificationBadge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    { label: metrics.evidences > 0 ? `${metrics.evidences} evidencias activas` : "Sin evidencias activas", tone: metrics.evidences > 0 ? "violet" : "rose" as SignalTone },
                    { label: educationCount > 0 ? `${educationCount} formaciones visibles` : "Formación pendiente", tone: educationCount > 0 ? "blue" : "amber" as SignalTone },
                    { label: publicLanguages.length > 0 ? `${publicLanguages.length} idiomas visibles` : "Idiomas pendientes", tone: publicLanguages.length > 0 ? "green" : "amber" as SignalTone },
                  ].map((signal) => (
                    <span key={signal.label} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${signalToneClasses(signal.tone)}`}>
                      {signal.label}
                    </span>
                  ))}
                </div>
                <p className="mt-5 text-sm font-medium text-slate-700">{overviewStatus} · {availabilityText}</p>
              </div>
            </div>

            {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
            {loading ? <p className="mt-4 text-sm text-slate-500">Cargando tu panel…</p> : null}
          </div>
        }
        right={
        <div className={`mx-auto w-full max-w-[21.75rem] rounded-[28px] border p-5 shadow-[0_20px_38px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6 xl:mx-0 xl:max-w-none ${opportunityCard.tone}`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Siguiente mejor acción</p>
          <h2 className="mt-2 text-lg font-semibold leading-tight text-slate-950">{opportunityCard.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{opportunityCard.body}</p>
          <div className="mt-4 rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Objetivo inmediato</p>
            <p className="mt-1 leading-6">Haz una mejora clara del perfil y vuelve para comprobar cómo sube la fortaleza general.</p>
          </div>
          <Link
            href={opportunityCard.href}
            className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black active:scale-[0.98]"
          >
            {opportunityCard.cta}
          </Link>
        </div>
      }
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(99,102,241,0.18),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(14,165,233,0.08),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/0 via-white/10 to-white/20" />
        <div className="pointer-events-none absolute -left-16 top-0 h-40 w-40 rounded-full bg-blue-100/40 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-52 w-52 rounded-full bg-slate-200/50 blur-3xl" />
      </OverviewHero>

      <OverviewProgressSection>
        <div className="flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Preparación actual</p>
          <div className="text-sm font-medium text-slate-600">
            {profileCompletion?.completed || 0}/{profileCompletion?.total || 0} hitos completados
          </div>
        </div>

        <SemanticProgressBar segments={preparationSegments} />
        <p className="text-sm font-medium text-slate-700">Lo que falta aquí es justo lo que más dudas genera cuando comparan perfiles.</p>
      </OverviewProgressSection>

      <OverviewHighlights>
        <div className="grid gap-4 xl:grid-cols-3">
          {highlightCards.map((card, index) => (
            <InsightCard
              key={`${card.title}-${card.href}`}
              {...card}
              tone={
                index === 0
                  ? "rounded-xl border border-blue-200/70 bg-white"
                  : index === 1
                    ? "rounded-xl border border-emerald-200/70 bg-white"
                    : "rounded-xl border border-amber-200/70 bg-white"
              }
              emphasis={index === 0 ? "primary" : "subtle"}
            />
          ))}
        </div>
      </OverviewHighlights>

      <OverviewExperiencesPreview
        action={
          <Link href="/candidate/experience" className="inline-flex rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">
            Gestionar experiencias
          </Link>
        }
      >
        <div className="space-y-0">
          {experienceTimeline.length ? (
            experienceTimeline.slice(0, 3).map((item: any) => <ExperienceSummaryCard key={item.id} item={item} />)
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
              Todavía no hay experiencias suficientes para mostrar un resumen. Añade una experiencia o revisa las importadas para empezar a construir tu señal profesional.
            </div>
          )}
        </div>
      </OverviewExperiencesPreview>

      <CandidateSurface tone="default" className="p-5 xl:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Tu perfil en una mirada</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">Qué ya pesa y qué aún necesita señal</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">Lectura rápida de tu perfil cuando una empresa decide.</p>
          </div>
          <Link href="/candidate/profile" className="inline-flex rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">
            Revisar perfil completo
          </Link>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <SnapshotItem
            label="Formación"
            value={educationCount > 0 ? `${educationCount} entrada${educationCount === 1 ? "" : "s"}` : "Pendiente"}
            hint={educationCount > 0 ? "Ya suma contexto real a tu perfil." : "Todavía no añade señal visible a tu perfil."}
            tone={educationCount > 0 ? "green" : "amber"}
          />
          <SnapshotItem
            label="Idiomas"
            value={publicLanguages.length > 0 ? `${publicLanguages.length} añadido${publicLanguages.length === 1 ? "" : "s"}` : "Pendiente"}
            hint={publicLanguages.length > 0 ? "Refuerzan tu lectura profesional y pública." : "Aún no ayudan a diferenciar mejor tu perfil."}
            tone={publicLanguages.length > 0 ? "blue" : "amber"}
          />
          <SnapshotItem
            label="Habilidades y logros"
            value={verifiedSkillsCount + achievementsCount > 0 ? `${verifiedSkillsCount + achievementsCount} señal${verifiedSkillsCount + achievementsCount === 1 ? "" : "es"}` : "Pendiente"}
            hint={verifiedSkillsCount + achievementsCount > 0 ? "Añaden detalle útil a cómo te verán las empresas." : "Todavía no están reforzando tu presentación."}
            tone={verifiedSkillsCount + achievementsCount > 0 ? "violet" : "amber"}
          />
          <SnapshotItem
            label="Evidencias"
            value={metrics.evidences > 0 ? `${metrics.evidences} subida${metrics.evidences === 1 ? "" : "s"}` : "Sin soporte"}
            hint={metrics.evidences > 0 ? "Ya reducen parte de la duda sobre tu trayectoria." : "Sin soporte documental, parte de tu valor sigue siendo declarativo."}
            tone={metrics.evidences > 0 ? "green" : "rose"}
          />
          <SnapshotItem
            label="Verificaciones"
            value={metrics.verified > 0 ? `${metrics.verified} completada${metrics.verified === 1 ? "" : "s"}` : metrics.inProcess > 0 ? `${metrics.inProcess} en curso` : "Sin validar"}
            hint={metrics.verified > 0 ? "Es la señal más fuerte para reducir incertidumbre." : metrics.inProcess > 0 ? "Puede subir tu credibilidad pronto." : "Todavía no hay validación que pese de verdad."}
            tone={metrics.verified > 0 ? "green" : metrics.inProcess > 0 ? "amber" : "rose"}
          />
          <SnapshotItem
            label="Visibilidad pública"
            value={publicProfileActive ? "Activa" : "Mejorable"}
            hint={publicProfileActive ? "Tu perfil ya puede compartirse como activo profesional." : "Todavía no está jugando como activo comercial de tu candidatura."}
            tone={publicProfileActive ? "violet" : "amber"}
          />
        </div>
      </CandidateSurface>

      <OverviewProfilePublicCard>
        <PublicProfileCard
          publicLink={publicLink}
          preview={publicPreview}
          trustScore={metrics.score}
          verified={metrics.verified}
          visibilityLabel={publicVisibilityLabel}
        />
      </OverviewProfilePublicCard>

      {showUpgrade ? (
        <OverviewUpgradeCard>
          <UpgradeCard planLabel={planCapabilities.label} summary={planCapabilities.summary} />
        </OverviewUpgradeCard>
      ) : null}
    </CandidatePresentationLayout>
  );
}
