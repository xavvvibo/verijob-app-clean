"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/browser";
import { VerificationBadge } from "@/components/brand/VerificationBadge";
import { summarizeCompanyCvImportUpdates } from "@/lib/candidate/import-update-summary";
import { mapCandidateAvailability } from "@/lib/candidate/availability";
import {
  buildCandidateOverviewNextActions,
  computeCandidateOverviewMetrics,
  resolveCandidateOverviewStatus,
} from "@/lib/candidate/overview-metrics";
import { getCandidatePlanCapabilities } from "@/lib/billing/planCapabilities";

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

function buildTrustSignals(args: { verified: number; inProcess: number; evidences: number; completed: boolean }) {
  return [
    `${args.verified} ${args.verified === 1 ? "experiencia verificada" : "experiencias verificadas"}`,
    `${args.inProcess} ${args.inProcess === 1 ? "verificación en curso" : "verificaciones en curso"}`,
    `${args.evidences} ${args.evidences === 1 ? "documento útil" : "documentos útiles"}`,
    args.completed ? "Perfil listo para compartir" : "Perfil todavía mejorable",
  ];
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

function buildPrimaryAction(args: {
  nextActions: { label: string; href: string }[];
  metrics: ReturnType<typeof computeCandidateOverviewMetrics>;
  profileCompletionScore: number;
  experienceCount: number;
}) {
  if (args.nextActions[0]) {
    const first = args.nextActions[0];
    let label = first.label;
    let rationale = "Es la forma más rápida de reforzar cómo te verán las empresas.";
    if (first.href.includes("/candidate/evidence")) {
      label = "Sube una prueba y aumenta tu credibilidad";
      rationale = "Una prueba real puede reforzar claramente tu perfil y hacerte más competitivo frente a otros candidatos.";
    } else if (first.href.includes("/candidate/verifications")) {
      label = "Mueve una verificación y gana solidez";
      rationale = "Cerrar una verificación pendiente mejora tu señal profesional y reduce dudas cuando una empresa revisa tu perfil.";
    } else if (first.href.includes("/candidate/profile")) {
      label = "Completa tu perfil y transmite más confianza";
      rationale = "Los perfiles más completos resultan más claros, más serios y más creíbles desde la primera impresión.";
    } else if (first.href.includes("/candidate/experience")) {
      label = "Añade tu experiencia y activa tu señal profesional";
      rationale = "Sin experiencia visible, tu perfil todavía no puede transmitir valor real a una empresa.";
    }
    return { label, href: first.href, rationale };
  }

  if (args.metrics.evidences === 0 && args.experienceCount > 0) {
    return {
      label: "Sube una prueba y aumenta tu credibilidad",
      href: "/candidate/evidence",
      rationale: "Un documento bien alineado puede reforzar claramente tu perfil sin rehacer todo lo demás.",
    };
  }

  if (args.profileCompletionScore < 70) {
    return {
      label: "Completa tu perfil y transmite más confianza",
      href: "/candidate/profile",
      rationale: "Un perfil más completo transmite mejor tu valor incluso antes de una verificación.",
    };
  }

  return {
    label: "Revisa cómo te ven las empresas",
    href: "/candidate/share",
    rationale: "Revisa cómo te verán las empresas y comparte tu mejor versión.",
  };
}

function buildEmployerLensCopy(args: {
  verified: number;
  inProcess: number;
  evidences: number;
  profileCompletionScore: number;
}) {
  if (args.verified >= 2 || (args.verified >= 1 && args.evidences >= 1)) {
    return "Tu perfil compite con ventaja frente a perfiles sin verificar y ya transmite una señal profesional sólida.";
  }
  if (args.verified >= 1 || args.inProcess >= 1 || args.evidences >= 1) {
    return "Perfil con credibilidad media. Ya transmites señales reales, pero aún puedes destacar más.";
  }
  if (args.profileCompletionScore >= 60) {
    return "Tu base es buena, pero sigues por debajo de un perfil reforzado con evidencias o verificaciones reales.";
  }
  return "Todavía estás lejos de tu mejor versión profesional. Un solo paso útil puede cambiar cómo te perciben.";
}

function buildProfileMilestones(args: {
  experienceCount: number;
  profileCompletionScore: number;
  metrics: ReturnType<typeof computeCandidateOverviewMetrics>;
}) {
  return [
    {
      id: "profile",
      label: "Perfil base completo",
      description: "Foto, titular, ubicación y datos clave listos.",
      status: args.profileCompletionScore >= 70 ? "done" : args.profileCompletionScore >= 35 ? "progress" : "pending",
    },
    {
      id: "experience",
      label: "Experiencias cargadas",
      description: args.experienceCount > 0 ? `${args.experienceCount} registradas` : "Añade experiencia laboral",
      status: args.experienceCount > 0 ? "done" : "pending",
    },
    {
      id: "verification",
      label: "Verificación activa",
      description:
        args.metrics.verified > 0
          ? `${args.metrics.verified} verificada${args.metrics.verified === 1 ? "" : "s"}`
          : args.metrics.inProcess > 0
            ? `${args.metrics.inProcess} en curso`
            : "Todavía sin verificar",
      status: args.metrics.verified > 0 ? "done" : args.metrics.inProcess > 0 ? "progress" : "pending",
    },
    {
      id: "documents",
      label: "Documentación útil",
      description: args.metrics.evidences > 0 ? `${args.metrics.evidences} subida${args.metrics.evidences === 1 ? "" : "s"}` : "Sin soporte documental todavía",
      status: args.metrics.evidences > 0 ? "done" : "pending",
    },
  ];
}

function buildHighlightCards(args: {
  metrics: ReturnType<typeof computeCandidateOverviewMetrics>;
  profileCompletionScore: number;
  experienceCount: number;
}) {
  const cards: Array<{ title: string; body: string; cta: string; href: string; tone: string }> = [];

  if (args.metrics.evidences === 0 && args.experienceCount > 0) {
    cards.push({
      title: "Aumenta tu Trust Score",
      body: "Una evidencia válida puede reforzar claramente tu perfil y hacer que tu experiencia pese más cuando una empresa la revise.",
      cta: "Sube una prueba",
      href: "/candidate/evidence",
      tone: "border-blue-200 bg-blue-50/70",
    });
  }

  if (args.profileCompletionScore < 70) {
    cards.push({
      title: "Completa tu perfil",
      body: "Los perfiles más completos generan más confianza y facilitan que una empresa entienda tu valor desde el primer vistazo.",
      cta: "Completa tu perfil",
      href: "/candidate/profile",
      tone: "border-amber-200 bg-amber-50/70",
    });
  }

  if (args.metrics.inProcess > 0) {
    cards.push({
      title: "Refuerza una experiencia en curso",
      body: "Cerrar verificaciones pendientes mejora tu señal profesional y hace tu perfil más competitivo sin añadir ruido.",
      cta: "Revisa verificaciones",
      href: "/candidate/verifications",
      tone: "border-emerald-200 bg-emerald-50/70",
    });
  }

  if (args.metrics.verified === 0 && args.metrics.inProcess === 0 && args.experienceCount > 0) {
    cards.push({
      title: "Activa tu primera verificación",
      body: "Una experiencia validada es la señal más potente para destacar frente a una empresa y elevar tu nivel de confianza.",
      cta: "Solicita verificación",
      href: "/candidate/verifications/new",
      tone: "border-slate-200 bg-slate-50",
    });
  }

  return cards.slice(0, 3);
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
      <div className="relative h-28 w-28">
        {finalAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={finalAvatarUrl} alt={fullName || "Avatar"} className="h-28 w-28 rounded-[28px] border border-white/70 object-cover shadow-md" />
        ) : (
          <div className="flex h-28 w-28 items-center justify-center rounded-[28px] border border-white/70 bg-white text-3xl font-semibold text-slate-700 shadow-md">
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
  const safeScore = clamp(score);
  const progressStyle = {
    background: `conic-gradient(rgb(15 23 42) ${safeScore * 3.6}deg, rgb(219 234 254) 0deg)`,
  };
  return (
    <div
      className="relative flex h-48 w-48 scale-[1.08] items-center justify-center rounded-full p-[10px] shadow-[0_0_40px_rgba(99,102,241,0.18),0_0_80px_rgba(99,102,241,0.08)] transition-transform duration-300 motion-safe:animate-[fade-in_350ms_ease-out] motion-safe:[animation-fill-mode:both]"
      style={progressStyle}
    >
      <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
        <span className="text-[3rem] font-semibold tabular-nums text-slate-950">{safeScore}</span>
        <span className="mt-1 text-[11px] font-semibold tracking-[0.01em] text-slate-700">Tu nivel de confianza</span>
        <span className="mt-2 max-w-[88px] text-[11px] font-medium leading-4 text-slate-600">{stateTitle}</span>
      </div>
    </div>
  );
}

function ProgressMilestone({
  label,
  status,
}: {
  label: string;
  status: "done" | "progress" | "pending";
}) {
  const tone =
    status === "done"
      ? "border-emerald-200/90 text-emerald-800"
      : status === "progress"
        ? "border-amber-200/90 text-amber-800"
        : "border-slate-200 text-slate-600";
  const dot =
    status === "done"
      ? "bg-emerald-500"
      : status === "progress"
        ? "bg-amber-500"
        : "bg-slate-300";

  return (
    <div className={`rounded-full border bg-transparent px-3.5 py-2 ${tone}`}>
      <div className="flex items-center gap-2.5">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        <p className="text-xs font-semibold sm:text-sm">{label}</p>
      </div>
    </div>
  );
}

function InsightCard({
  title,
  body,
  cta,
  href,
  tone,
  emphasis = "subtle",
}: {
  title: string;
  body: string;
  cta: string;
  href: string;
  tone: string;
  emphasis?: "primary" | "subtle";
}) {
  const buttonClass =
    emphasis === "primary"
      ? "mt-5 inline-flex rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-[1px] hover:bg-black hover:shadow-sm"
      : "mt-4 inline-flex rounded-lg border border-slate-200 bg-white/80 px-3.5 py-2 text-xs font-semibold text-slate-900 transition-all duration-150 hover:-translate-y-[1px] hover:bg-slate-50 hover:shadow-sm";
  return (
    <article className={`rounded-xl p-5 transition-all duration-150 hover:-translate-y-[1px] hover:shadow-sm ${tone}`}>
      <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
      <Link href={href} className={buttonClass}>
        {cta}
      </Link>
    </article>
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
  return (
    <section className="rounded-2xl bg-slate-50/80 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Esto es lo que verá una empresa</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">Perfil público verificable</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Tu versión pública y compartible, preparada para generar confianza sin exponer datos sensibles.</p>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Vista real de evaluación</div>
          <div className="mt-2 text-base font-semibold text-slate-900">{visibilityLabel}</div>
          <div className="text-xs text-slate-600">{verified} verificaciones visibles</div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="rounded-xl bg-white/70 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-200/80 px-3 py-1 text-xs font-semibold text-slate-700">
              Trust score {Math.round(trustScore)}
            </span>
            <span className="rounded-full border border-slate-200/80 px-3 py-1 text-xs font-semibold text-slate-700">
              {preview?.teaser?.verified_experiences ?? verified} experiencias verificadas
            </span>
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-900">
            {preview?.teaser?.public_name || "Perfil público activo"}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {[preview?.teaser?.title, preview?.teaser?.location].filter(Boolean).join(" · ") || "Resumen profesional visible para empresa"}
          </p>
          <p className="mt-4 text-sm leading-6 text-slate-700">
            {preview?.teaser?.summary || "Tu perfil público ya puede mostrar una muestra profesional, ordenada y verificable de tu trayectoria."}
          </p>
        </div>

        <div className="rounded-xl bg-white/70 p-4">
          <p className="text-sm font-semibold text-slate-900">Acciones rápidas</p>
          <div className="mt-4 flex flex-col gap-3">
            <Link href="/candidate/share" className="inline-flex justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black">
              Ver perfil público
            </Link>
            <Link href="/candidate/share" className="inline-flex justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50">
              Compartir perfil
            </Link>
          </div>
          <p className="mt-4 break-all text-xs text-slate-500">{publicLink || `${PUBLIC_PROFILE_ORIGIN}/p/[token]`}</p>
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
    <section className="rounded-2xl bg-gradient-to-r from-indigo-50/60 to-purple-50/60 p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-700">Siguiente nivel</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">Accede a una visibilidad profesional completa</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">Presenta una versión más sólida ante empresas, con mejor visibilidad y una impresión más profesional.</p>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
            <li>Más visibilidad frente a empresas</li>
            <li>Mejor presentación al compartir</li>
            <li>Un perfil más sólido y competitivo</li>
          </ul>
        </div>
        <div className="min-w-[260px]">
          <p className="text-sm font-semibold text-slate-900">Tu plan actual: {planLabel}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{summary}</p>
          <Link href="/candidate/subscription" className="mt-4 inline-flex w-full justify-center rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-white">
            Desbloquear perfil completo
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
        setTrustScore(typeof trustRes?.trust_score === "number" ? trustRes.trust_score : null);
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

  const overviewNextActions = useMemo(
    () => buildCandidateOverviewNextActions({ experienceCount, metrics, profileCompletionScore }),
    [experienceCount, metrics, profileCompletionScore]
  );

  const primaryAction = useMemo(
    () =>
      buildPrimaryAction({
        nextActions: overviewNextActions,
        metrics,
        profileCompletionScore,
        experienceCount,
      }),
    [experienceCount, metrics, overviewNextActions, profileCompletionScore]
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

  const trustSignals = useMemo(
    () =>
      buildTrustSignals({
        verified: metrics.verified,
        inProcess: metrics.inProcess,
        evidences: metrics.evidences,
        completed: profileCompletionScore >= 70,
      }),
    [metrics.evidences, metrics.inProcess, metrics.verified, profileCompletionScore]
  );

  const profileMilestones = useMemo(
    () =>
      buildProfileMilestones({
        experienceCount,
        profileCompletionScore,
        metrics,
      }),
    [experienceCount, metrics, profileCompletionScore]
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
  const publicVisibilityLabel =
    publicPreview?.teaser?.profile_visibility ||
    candidateProfile?.public_profile_settings?.experienceVisibility?.length
      ? "Perfil compartible"
      : "Vista pública limitada";
  const employerLensCopy = useMemo(
    () =>
      buildEmployerLensCopy({
        verified: metrics.verified,
        inProcess: metrics.inProcess,
        evidences: metrics.evidences,
        profileCompletionScore,
      }),
    [metrics.evidences, metrics.inProcess, metrics.verified, profileCompletionScore]
  );

  return (
    <div className="mx-auto max-w-[1320px] space-y-20 bg-white px-8 py-12">
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

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-100 via-indigo-100/70 to-blue-100/60 px-8 py-[4.5rem] sm:px-8 sm:py-[5rem] xl:px-9 xl:py-[5.25rem]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(99,102,241,0.18),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(14,165,233,0.08),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/0 via-white/10 to-white/20" />
        <div className="pointer-events-none absolute -left-16 top-0 h-40 w-40 rounded-full bg-blue-100/40 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-52 w-52 rounded-full bg-slate-200/50 blur-3xl" />

        <div className="relative grid items-center gap-14 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="min-w-0">
            <div className="flex items-start gap-5">
              <AvatarView
                fullName={profile?.full_name}
                avatarUrl={profile?.avatar_url}
                onAvatarSaved={(next) => setProfile((prev) => ({ ...(prev || {}), avatar_url: next }))}
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Estado actual del perfil</p>
                <h1 className="mt-3 whitespace-normal break-words text-3xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-[3.25rem]">
                  {profile?.full_name || "Tu resumen profesional"}
                </h1>
                <p className="mt-4 text-base text-slate-700">{profile?.title || "Profesional verificable en Verijob"}</p>
                <p className="mt-1 text-sm text-slate-500">{profile?.location || "Ubicación no definida"}</p>

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <VerificationBadge tone={metrics.verified > 0 ? "company_verified" : metrics.inProcess > 0 ? "in_progress" : "trust_visible"}>
                    {trustState.title}
                  </VerificationBadge>
                  <VerificationBadge tone={profileCompletionScore >= 70 ? "company_verified" : "in_progress"}>
                    {profileStage}
                  </VerificationBadge>
                </div>
                <p className="mt-8 text-sm font-medium text-slate-700">
                  {overviewStatus} · {availabilityText}
                </p>

                <div className="mt-9 flex items-center gap-8">
                  <TrustRing score={metrics.score} stateTitle={trustState.title} />
                  <div className="min-w-0">
                    <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${trustState.tone}`}>
                      {metrics.verified > 0 ? "Perfil parcialmente verificado" : trustState.title}
                    </div>
                    <p className="mt-3 max-w-md text-base font-medium leading-7 text-slate-800">
                      {metrics.verified > 0
                        ? "Credibilidad media. Ya transmites señales reales, pero aún puedes destacar más."
                        : employerLensCopy}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {trustSignals.slice(0, 2).map((signal) => (
                        <span key={signal} className="rounded-full border border-slate-200 bg-white/50 px-3 py-1 text-xs font-medium text-slate-700">
                          {signal}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
            {loading ? <p className="mt-4 text-sm text-slate-500">Cargando tu panel…</p> : null}
          </div>

          <div className="rounded-2xl bg-black p-7 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Tu siguiente mejor paso</p>
            <h2 className="mt-3 text-2xl font-semibold leading-tight">Haz que las empresas confíen en ti desde hoy</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">Una prueba real puede marcar la diferencia.</p>
            <Link
              href={primaryAction.href}
              className="mt-7 inline-flex w-full items-center justify-center rounded-lg bg-white px-5 py-[1.35rem] text-base font-semibold text-slate-950 transition hover:scale-[1.02] hover:bg-slate-100 active:scale-[0.98]"
            >
              {primaryAction.label}
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex items-center justify-between text-sm text-slate-500">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Progreso del perfil</p>
          <div className="text-sm font-medium text-slate-600">
            {profileCompletion?.completed || 0}/{profileCompletion?.total || 0} hitos completados
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {profileMilestones.map((milestone) => (
            <ProgressMilestone
              key={milestone.id}
              label={milestone.label}
              status={milestone.status as "done" | "progress" | "pending"}
            />
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Qué te falta para destacar</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Qué hacer ahora</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {highlightCards.length ? (
            highlightCards.slice(0, 2).map((card, index) => (
              <InsightCard
                key={`${card.title}-${card.href}`}
                {...card}
                tone={index === 0 ? "rounded-xl border border-slate-200/70 bg-blue-50/55" : "rounded-xl border border-slate-200/70 bg-emerald-50/45"}
                emphasis={index === 0 ? "primary" : "subtle"}
              />
            ))
          ) : (
            <InsightCard
              title="Tu perfil va bien encaminado"
              body="Ya tienes una base sólida. Mantener tu perfil al día y reforzar una experiencia cuando convenga te ayuda a seguir compitiendo con ventaja."
              cta="Ver verificaciones"
              href="/candidate/verifications"
              tone="rounded-xl border border-slate-200/70 bg-blue-50/55"
              emphasis="primary"
            />
          )}
        </div>
      </section>

      <section className="space-y-10">
        <section className="space-y-7">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Experiencias clave</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">Experiencias que más pesan en tu perfil</h2>
            </div>
            <Link href="/candidate/experience" className="inline-flex rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">
              Ver todas las experiencias
            </Link>
          </div>

          <div className="space-y-0">
            {experienceTimeline.length ? (
              experienceTimeline.slice(0, 2).map((item: any) => <ExperienceSummaryCard key={item.id} item={item} />)
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
                Todavía no hay experiencias suficientes para mostrar un resumen. Añade una experiencia o revisa las importadas para empezar a construir tu señal profesional.
              </div>
            )}
          </div>
        </section>
      </section>

      <PublicProfileCard
        publicLink={publicLink}
        preview={publicPreview}
        trustScore={metrics.score}
        verified={metrics.verified}
        visibilityLabel={publicVisibilityLabel}
      />

      {showUpgrade ? <UpgradeCard planLabel={planCapabilities.label} summary={planCapabilities.summary} /> : null}
    </div>
  );
}
