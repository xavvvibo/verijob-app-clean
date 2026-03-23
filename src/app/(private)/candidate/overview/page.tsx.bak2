"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/browser";
import { VerificationBadge } from "@/components/brand/VerificationBadge";
import { summarizeCompanyCvImportUpdates } from "@/lib/candidate/import-update-summary";
import { mapCandidateAvailability } from "@/lib/candidate/availability";

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
      summary: "Tu perfil ya muestra señales claras de experiencia validada y credibilidad profesional.",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
    };
  }
  if (args.verified >= 1 || args.inProcess >= 1 || args.evidences >= 1 || args.profileCompletionScore >= 55) {
    return {
      title: "Confianza media",
      summary: "Ya has dado pasos sólidos. Una validación más o documentación adicional reforzarán tu perfil.",
      tone: "border-blue-200 bg-blue-50 text-blue-900",
    };
  }
  return {
    title: "Perfil inicial",
    summary: "Tu perfil ya está en marcha. La siguiente mejor acción es validar una experiencia o añadir documentación.",
    tone: "border-amber-200 bg-amber-50 text-amber-900",
  };
}

function buildTrustSignals(args: { verified: number; inProcess: number; evidences: number; completed: boolean }) {
  return [
    `${args.verified} ${args.verified === 1 ? "experiencia verificada" : "experiencias verificadas"}`,
    `${args.inProcess} ${args.inProcess === 1 ? "verificación en proceso" : "verificaciones en proceso"}`,
    `${args.evidences} ${args.evidences === 1 ? "documento subido" : "documentos subidos"}`,
    args.completed ? "Perfil completado" : "Perfil por completar",
  ];
}

function TrustSnapshot({
  state,
  signals,
  score,
}: {
  state: TrustState;
  signals: string[];
  score: number;
}) {
  const safeScore = clamp(score);
  const progressStyle = {
    background: `conic-gradient(rgb(15 23 42) ${safeScore * 3.6}deg, rgb(226 232 240) 0deg)`,
  };
  return (
    <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full" style={progressStyle}>
          <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-white text-slate-900">
            <span className="text-2xl font-semibold tabular-nums">{safeScore}</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Trust</span>
          </div>
        </div>
        <div className="min-w-0">
          <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${state.tone}`}>
            {state.title}
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{state.summary}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {signals.map((signal) => (
          <span key={signal} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
            {signal}
          </span>
        ))}
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">{label}</div>
      <div className="mt-3 text-3xl font-semibold tabular-nums text-gray-900">{value}</div>
    </div>
  );
}

function SectionTab({
  href,
  label,
  highlighted = false,
}: {
  href: string;
  label: string;
  highlighted?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition",
        highlighted
          ? "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100"
          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function QuickActionCard({
  title,
  description,
  href,
  cta,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-600">{description}</p>
      <div className="mt-4">
        <Link
          href={href}
          className="inline-flex rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50"
        >
          {cta}
        </Link>
      </div>
    </article>
  );
}

function SummaryCard({
  title,
  summary,
  href,
  cta,
}: {
  title: string;
  summary: string;
  href: string;
  cta: string;
}) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-600">{summary}</p>
      <div className="mt-4">
        <Link
          href={href}
          className="inline-flex rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50"
        >
          {cta}
        </Link>
      </div>
    </article>
  );
}

function listCount(raw: any) {
  return Array.isArray(raw) ? raw.length : 0;
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
          <img src={finalAvatarUrl} alt={fullName || "Avatar"} className="h-28 w-28 rounded-full border border-gray-200 object-cover" />
        ) : (
          <div className="flex h-28 w-28 items-center justify-center rounded-full border border-gray-200 bg-gray-100 text-3xl font-semibold text-gray-700">
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
          className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {saving ? "Subiendo…" : "Subir foto"}
        </button>
        {avatarUrl ? (
          <button
            type="button"
            onClick={() => void removeAvatar()}
            disabled={saving}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60"
          >
            Quitar foto
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-gray-500">JPG, PNG o WEBP. Máximo 4MB.</p>
      {error ? <div className="mt-2 text-xs text-red-600">{error}</div> : null}
    </div>
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

        const [profileRes, verificationsRes, employmentRes, profileApiRes, trustRes] = await Promise.all([
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

  const metrics = useMemo(() => {
    const total = Math.max(verifications.length, employmentRecords.length, experienceCount);
    const verified = employmentRecords.filter((row) => {
      const s = String(row?.verification_status || "").toLowerCase().trim();
      return s === "verified" || s === "approved" || s === "verified_document";
    }).length;
    const inProcess = verifications.filter((v) => {
      const s = String(v.status || "").toLowerCase();
      return s.includes("pending") || s.includes("review") || s.includes("requested");
    }).length;
    const confirmed = verifications.filter((v) => !!v.company_confirmed).length;
    const evidences = verifications.reduce((acc, v) => acc + Number(v.evidence_count || 0), 0);
    const baseScore = total ? Math.round(((verified / total) * 0.5 + (confirmed / total) * 0.3 + Math.min(1, evidences / Math.max(1, total * 2)) * 0.2) * 100) : 0;
    const score = trustScore == null ? baseScore : clamp(trustScore);

    return { total, verified, inProcess, confirmed, evidences, score };
  }, [employmentRecords, experienceCount, verifications, trustScore]);

  const educationCount = useMemo(() => listCount(candidateProfile?.education), [candidateProfile]);
  const achievementsCount = useMemo(
    () => listCount(candidateProfile?.achievements_catalog?.all || candidateProfile?.achievements || candidateProfile?.certifications),
    [candidateProfile]
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
    ? candidateProfile.experience_timeline.slice(0, 4)
    : [];

  const profileCompletionScore = Number(profileCompletion?.score || 0);

  const profileStage = useMemo(() => {
    if (profileCompletionScore >= 85) return "Perfil sólido";
    if (profileCompletionScore >= 55) return "Perfil en progreso";
    return "Perfil inicial";
  }, [profileCompletionScore]);

  const overviewStatus = useMemo(() => {
    if (metrics.verified > 0) return "Perfil con validación activa";
    if (metrics.total > 0) return "Verificación en curso";
    if (experienceCount > 0) return "Perfil iniciado";
    return "Perfil por activar";
  }, [experienceCount, metrics.total, metrics.verified]);

  const overviewNextActions = useMemo(() => {
    const actions: Array<{ label: string; href: string }> = [];
    if (experienceCount === 0) {
      actions.push({ label: "Añadir tu primera experiencia", href: "/candidate/experience?new=1#manual-experience" });
    }
    if (experienceCount > 0 && metrics.total === 0) {
      actions.push({ label: "Enviar una verificación", href: "/candidate/verifications/new" });
    }
    if (metrics.total > 0 && metrics.evidences === 0) {
      actions.push({ label: "Subir documentación", href: "/candidate/evidence" });
    }
    if (profileCompletionScore < 70) {
      actions.push({ label: "Completar tu perfil", href: "/candidate/profile" });
    }
    return actions.slice(0, 3);
  }, [experienceCount, metrics.evidences, metrics.total, profileCompletionScore]);

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

  const availabilityText = useMemo(
    () => mapCandidateAvailability(candidateProfile?.job_search_status) || "Disponibilidad no definida",
    [candidateProfile?.job_search_status]
  );

  return (
    <div className="space-y-6">
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
          ) : companyCvImportSummary.updatesCount > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-900">
                Importación pendiente de revisión
              </span>
              <Link href="/candidate/import-updates" className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black">
                Ver propuesta de cambios
              </Link>
            </div>
          ) : importedExperiences.length ? (
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/candidate/experience" className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black">
                Confirmar experiencias
              </Link>
              <Link href="/candidate/education" className="inline-flex rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100">
                Revisar formación
              </Link>
              <Link href="/candidate/achievements" className="inline-flex rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100">
                Revisar idiomas y logros
              </Link>
              <Link href="/candidate/experience?new=1#manual-experience" className="inline-flex rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100">
                Editar antes de continuar
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      <header className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-white via-blue-50/70 to-white p-7 shadow-sm">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-100/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-0 h-44 w-72 rounded-full bg-blue-100/40 blur-3xl" />
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-start gap-4">
              <AvatarView
                fullName={profile?.full_name}
                avatarUrl={profile?.avatar_url}
                onAvatarSaved={(next) => setProfile((prev) => ({ ...(prev || {}), avatar_url: next }))}
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Perfil profesional verificable</p>
                <h1 className="mt-2 truncate text-4xl font-semibold text-gray-900">
                  {profile?.full_name || "Tu resumen profesional"}
                </h1>
                <p className="mt-2 text-base text-gray-600">{profile?.title || "Profesional verificable en Verijob"}</p>
                <p className="mt-1 text-sm text-gray-500">{profile?.location || "Ubicación no definida"}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <VerificationBadge tone={metrics.verified > 0 ? "company_verified" : metrics.inProcess > 0 ? "in_progress" : "trust_visible"}>
                    {trustState.title}
                  </VerificationBadge>
                  <VerificationBadge tone={profileCompletionScore >= 55 ? "company_verified" : "in_progress"}>
                    {profileStage}
                  </VerificationBadge>
                  <VerificationBadge tone="business">{availabilityText}</VerificationBadge>
                </div>
              </div>
            </div>

            {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
            {loading ? <p className="mt-4 text-sm text-gray-500">Cargando datos…</p> : null}
          </div>

          <div className="shrink-0 self-center">
            <TrustSnapshot state={trustState} signals={trustSignals} score={metrics.score} />
          </div>
        </div>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Estado del perfil</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">{overviewStatus}</h2>
            <p className="mt-2 text-sm text-slate-600">
              {metrics.verified > 0
                ? "Tu perfil ya transmite confianza a las empresas con una experiencia validada."
                : metrics.total > 0
                  ? "Ya has enviado una solicitud. Mientras llega la respuesta, puedes reforzar tu perfil con documentación."
                  : experienceCount > 0
                    ? "Ya has arrancado tu perfil. El siguiente paso más útil es pedir una verificación."
                    : "Empieza añadiendo una experiencia para activar tu perfil profesional."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {trustSignals.map((signal) => (
                <span key={signal} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                  {signal}
                </span>
              ))}
            </div>
          </div>

          <div className="min-w-[260px] rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Siguientes acciones recomendadas</p>
            <div className="mt-3 flex flex-col gap-2">
              {overviewNextActions.length > 0 ? (
                overviewNextActions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                  >
                    {action.label}
                  </Link>
                ))
              ) : (
                <p className="text-sm text-slate-600">Tu perfil ya está bien encaminado. Mantén la información al día y añade otra verificación cuando puedas.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <SectionTab href="/candidate/profile" label="Perfil" highlighted />
          <SectionTab href="/candidate/experience" label="Experiencias" />
          <SectionTab href="/candidate/settings" label="Ajustes" />
          <SectionTab href="/candidate/education" label="Educación" />
          <SectionTab href="/candidate/achievements" label="Logros" />
          <SectionTab href="/candidate/evidence" label="Evidencias" />
          <SectionTab href="/candidate/verifications" label="Verificaciones" />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        <Kpi label="Confianza actual" value={trustState.title} />
        <Kpi label="Perfil completado" value={`${profileCompletionScore}%`} />
        <Kpi label="Experiencias verificadas" value={metrics.verified} />
        <Kpi label="En proceso" value={metrics.inProcess} />
        <Kpi label="Documentación" value={metrics.evidences} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <QuickActionCard
          title="Perfil público"
          description="Revisa cómo te ven las empresas antes de compartir tu enlace verificable."
          href="/candidate/share"
          cta="Ver perfil público"
        />
        <QuickActionCard
          title="Verificaciones"
          description="Gestiona solicitudes y mejora la solidez de tu historial con validaciones reales."
          href="/candidate/verifications"
          cta="Gestionar verificaciones"
        />
        <QuickActionCard
          title="Evidencias"
          description="Añade documentos para reforzar experiencias y acelerar tu credibilidad."
          href="/candidate/evidence"
          cta="Revisar evidencias"
        />
      </section>

      {experienceTimeline.length > 0 ? (
        <section className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Tu trayectoria ya transmite estas señales</h2>
              <p className="mt-1 text-sm text-gray-600">
                Cada experiencia muestra si ya genera confianza, si está en proceso o si todavía necesita validación.
              </p>
            </div>
            <Link href="/candidate/experience" className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">
              Ver experiencias
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {experienceTimeline.map((item: any) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{item.role_title || "Experiencia profesional"}</h3>
                    <p className="mt-1 text-sm text-slate-600">{item.company_name || "Empresa no definida"}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatTimelineDate(item.start_date) || "Inicio no definido"} · {item.end_date ? formatTimelineDate(item.end_date) : "Actualidad"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${item.status_tone}`}>
                      {item.status_label}
                    </span>
                    {item.support_label ? (
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                        {item.support_label}
                      </span>
                    ) : null}
                  </div>
                </div>

                <p className="mt-3 text-sm text-slate-700">{item.explanation}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Qué ya transmite confianza en tu perfil</h2>
          <p className="text-xs text-gray-500">Señales visibles para empresa</p>
        </div>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          Tu perfil gana credibilidad con experiencias verificadas, documentación útil y un historial bien completado. No necesitas entender el cálculo interno para saber qué reforzarlo.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Experiencias verificadas" value={metrics.verified} />
          <Kpi label="Verificaciones en proceso" value={metrics.inProcess} />
          <Kpi label="Documentos subidos" value={metrics.evidences} />
          <Kpi label="Perfil completado" value={`${profileCompletionScore}%`} />
        </div>
        <ul className="mt-4 space-y-1 text-xs text-gray-500">
          <li>• Una experiencia verificada es la señal más clara de confianza para una empresa.</li>
          <li>• Si ya tienes una verificación en proceso, tu perfil muestra avance real.</li>
          <li>• Añadir documentación puede reforzar tu perfil mientras esperas respuesta.</li>
        </ul>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">CV estructurado</h2>
          <p className="text-xs text-gray-500">Resumen de bloques</p>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <SummaryCard
            title="Datos personales"
            summary={profile?.full_name ? "Información base completada. Puedes mantenerla actualizada en ajustes." : "Completa nombre, ubicación y datos básicos en ajustes."}
            href="/candidate/settings"
            cta="Editar"
          />
          <SummaryCard
            title="Experiencia laboral"
            summary={
              experienceCount > 0
                ? `${experienceCount} experiencias detectadas. Las importadas desde CV se muestran como “Sin verificar” hasta tener validación real.`
                : "Aún no hay experiencias cargadas. Sube tu CV o añade experiencias manualmente."
            }
            href="/candidate/experience"
            cta="Gestionar"
          />
          <SummaryCard
            title="Datos académicos"
            summary={educationCount > 0 ? `${educationCount} elementos académicos disponibles para tu perfil.` : "Todavía no hay formación académica registrada."}
            href="/candidate/education"
            cta="Editar"
          />
        </div>

        <div className="mt-4 grid gap-4">
          <SummaryCard
            title="Idiomas, certificaciones y logros"
            summary={achievementsCount > 0 ? `${achievementsCount} señales adicionales registradas.` : "Añade idiomas, certificaciones y logros para reforzar tu perfil profesional."}
            href="/candidate/achievements"
            cta="Gestionar"
          />
        </div>
      </section>
    </div>
  );
}
