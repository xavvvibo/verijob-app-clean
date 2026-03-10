"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/browser";
import { TrustLevelBadge, VerificationBadge } from "@/components/brand/VerificationBadge";

type ProfileLite = {
  full_name?: string | null;
  title?: string | null;
  location?: string | null;
  avatar_url?: string | null;
};

type CandidateProfilePayload = Record<string, any> | null;

type VerificationRow = {
  status: string | null;
  company_confirmed: boolean | null;
  evidence_count: number | null;
};

type TrustBreakdown = {
  verification?: number;
  evidence?: number;
  consistency?: number;
  reuse?: number;
};

function clamp(n: number, a = 0, b = 100) {
  return Math.max(a, Math.min(b, n));
}

function scoreTone(score: number) {
  if (score >= 80) {
    return {
      ring: "stroke-green-600",
      badge: "bg-green-50 text-green-700 border-green-100",
      label: "Credibilidad alta",
    };
  }
  if (score >= 45) {
    return {
      ring: "stroke-blue-600",
      badge: "bg-blue-50 text-blue-700 border-blue-100",
      label: "Credibilidad media",
    };
  }
  return {
    ring: "stroke-amber-500",
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    label: "Credibilidad en desarrollo",
  };
}

function TrustRing({ score }: { score: number }) {
  const s = clamp(score);
  const radius = 74;
  const stroke = 28;
  const normalized = radius - stroke * 0.5;
  const circumference = normalized * 2 * Math.PI;
  const offset = circumference - (s / 100) * circumference;
  const tone = scoreTone(s);

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex h-56 w-56 items-center justify-center">
        <svg height="224" width="224" className="rotate-[-90deg]">
          <circle stroke="#e5e7eb" fill="transparent" strokeWidth={stroke} r={normalized} cx="112" cy="112" />
          <circle
            strokeLinecap="round"
            className={`${tone.ring} transition-all duration-700`}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            r={normalized}
            cx="112"
            cy="112"
          />
        </svg>
        <div className="absolute text-center">
          <div className="text-4xl font-semibold text-gray-900 tabular-nums">{s}%</div>
          <div className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${tone.badge}`}>
            {tone.label}
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-sm text-gray-600">
        Añade evidencias o verifica tu experiencia para mejorar tu credibilidad.
      </p>
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

function AvatarView({
  fullName,
  avatarUrl,
  onAvatarSaved,
}: {
  fullName?: string | null;
  avatarUrl?: string | null;
  onAvatarSaved: (next: string | null) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarInput, setAvatarInput] = useState(avatarUrl || "");

  async function saveAvatarUrl() {
    setSaving(true);
    setError(null);
    try {
      const next = String(avatarInput || "").trim();
      const payload = next ? next : null;
      const { data: au } = await supabase.auth.getUser();
      if (!au?.user?.id) throw new Error("Sesión no válida");
      const { error: upErr } = await supabase.from("profiles").update({ avatar_url: payload }).eq("id", au.user.id);
      if (upErr) throw new Error(upErr.message);
      onAvatarSaved(payload);
      setOpen(false);
    } catch (e: any) {
      setError(e?.message || "No se pudo actualizar la foto de perfil.");
    } finally {
      setSaving(false);
    }
  }

  if (avatarUrl) {
    return (
      <div className="group relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl} alt={fullName || "Avatar"} className="h-28 w-28 rounded-full border border-gray-200 object-cover" />
        <button
          type="button"
          onClick={() => {
            setAvatarInput(avatarUrl || "");
            setOpen((v) => !v);
          }}
          className="absolute inset-0 hidden items-center justify-center rounded-full bg-black/45 text-xs font-semibold text-white group-hover:flex"
        >
          Cambiar foto
        </button>
        {open ? (
          <div className="absolute left-0 top-[116%] z-20 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
            <div className="text-xs font-semibold text-gray-900">URL de foto de perfil</div>
            <input
              value={avatarInput}
              onChange={(e) => setAvatarInput(e.target.value)}
              placeholder="https://..."
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
            />
            {error ? <div className="mt-2 text-xs text-red-600">{error}</div> : null}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => void saveAvatarUrl()}
                disabled={saving}
                className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAvatarInput("");
                  void saveAvatarUrl();
                }}
                disabled={saving}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60"
              >
                Quitar
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }
  const fallback = (fullName || "C").trim().charAt(0).toUpperCase();
  return (
    <div className="group relative">
      <div className="flex h-28 w-28 items-center justify-center rounded-full border border-gray-200 bg-gray-100 text-3xl font-semibold text-gray-700">
        {fallback}
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="absolute inset-0 hidden items-center justify-center rounded-full bg-black/45 text-xs font-semibold text-white group-hover:flex"
      >
        Cambiar foto
      </button>
      {open ? (
        <div className="absolute left-0 top-[116%] z-20 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
          <div className="text-xs font-semibold text-gray-900">URL de foto de perfil</div>
          <input
            value={avatarInput}
            onChange={(e) => setAvatarInput(e.target.value)}
            placeholder="https://..."
            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
          />
          {error ? <div className="mt-2 text-xs text-red-600">{error}</div> : null}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => void saveAvatarUrl()}
              disabled={saving}
              className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function CandidateOverview() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfilePayload>(null);
  const [verifications, setVerifications] = useState<VerificationRow[]>([]);
  const [trustScore, setTrustScore] = useState<number | null>(null);
  const [trustBreakdown, setTrustBreakdown] = useState<TrustBreakdown>({});
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

        const [profileRes, verificationsRes, profileApiRes, trustRes, experienceRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("full_name, title, location, avatar_url")
            .eq("id", userId)
            .maybeSingle(),
          supabase
            .from("verification_summary")
            .select("status, company_confirmed, evidence_count")
            .eq("candidate_id", userId),
          fetch("/api/candidate/profile", { credentials: "include" }).then((r) => r.json().catch(() => ({}))),
          fetch("/api/candidate/trust-score", { credentials: "include" }).then((r) => r.json().catch(() => ({}))),
          supabase.from("profile_experiences").select("id", { count: "exact", head: true }).eq("user_id", userId),
        ]);

        if (profileRes.error) throw profileRes.error;
        if (verificationsRes.error) throw verificationsRes.error;

        if (!alive) return;

        setProfile((profileRes.data || null) as ProfileLite | null);
        setVerifications((verificationsRes.data || []) as VerificationRow[]);
        setCandidateProfile(profileApiRes?.profile ?? null);
        setTrustScore(typeof trustRes?.trust_score === "number" ? trustRes.trust_score : null);
        setTrustBreakdown((trustRes?.breakdown || {}) as TrustBreakdown);
        setExperienceCount(Number(experienceRes.count || 0));
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
    const total = verifications.length;
    const verified = verifications.filter((v) => {
      const s = String(v.status || "").toLowerCase();
      return s === "verified" || s === "approved";
    }).length;
    const confirmed = verifications.filter((v) => !!v.company_confirmed).length;
    const evidences = verifications.reduce((acc, v) => acc + Number(v.evidence_count || 0), 0);
    const baseScore = total ? Math.round(((verified / total) * 0.5 + (confirmed / total) * 0.3 + Math.min(1, evidences / Math.max(1, total * 2)) * 0.2) * 100) : 0;
    const score = trustScore == null ? baseScore : clamp(trustScore);

    return { total, verified, confirmed, evidences, score };
  }, [verifications, trustScore]);

  const educationCount = useMemo(() => listCount(candidateProfile?.education), [candidateProfile]);
  const achievementsCount = useMemo(() => listCount(candidateProfile?.certifications), [candidateProfile]);

  const profileCompletion = useMemo(() => {
    const checks = [
      Boolean(profile?.full_name),
      experienceCount > 0,
      educationCount > 0,
      achievementsCount > 0,
      metrics.evidences > 0,
    ];
    const done = checks.filter(Boolean).length;
    return Math.round((done / checks.length) * 100);
  }, [profile?.full_name, experienceCount, educationCount, achievementsCount, metrics.evidences]);

  const profileStage = useMemo(() => {
    if (profileCompletion >= 85) return "Perfil sólido";
    if (profileCompletion >= 55) return "Perfil en progreso";
    return "Perfil inicial";
  }, [profileCompletion]);

  const availabilityText = useMemo(() => {
    const raw = String(candidateProfile?.job_search_status || "").toLowerCase();
    if (raw.includes("active")) return "Buscando activamente";
    if (raw.includes("open")) return "Abierto a oportunidades";
    if (raw.includes("not")) return "No disponible temporalmente";
    return "Disponibilidad no definida";
  }, [candidateProfile?.job_search_status]);

  return (
    <div className="space-y-6">
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
                  <TrustLevelBadge score={metrics.score} />
                  <VerificationBadge tone="trust_visible">Trust Score visible para empresas registradas</VerificationBadge>
                  <VerificationBadge tone={profileCompletion >= 55 ? "company_verified" : "in_progress"}>
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
            <TrustRing score={metrics.score} />
          </div>
        </div>
      </header>

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
        <Kpi label="Trust Score" value={`${metrics.score}%`} />
        <Kpi label="Progreso del perfil" value={`${profileCompletion}%`} />
        <Kpi label="Verificaciones" value={metrics.total} />
        <Kpi label="Aprobadas" value={metrics.verified} />
        <Kpi label="Evidencias" value={metrics.evidences} />
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

      <section className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Trust Score: {metrics.score} / 100</h2>
          <p className="text-xs text-gray-500">Desglose del cálculo</p>
        </div>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          Tu credibilidad se calcula combinando verificaciones empresariales, evidencias documentales, coherencia de historial y reutilización en procesos de selección.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Verificaciones empresariales" value={`${Number(trustBreakdown.verification ?? 0)} / 40`} />
          <Kpi label="Evidencias documentales" value={`${Number(trustBreakdown.evidence ?? 0)} / 30`} />
          <Kpi label="Coherencia del historial" value={`${Number(trustBreakdown.consistency ?? 0)} / 15`} />
          <Kpi label="Reutilización por empresas" value={`${Number(trustBreakdown.reuse ?? 0)} / 15`} />
        </div>
        <ul className="mt-4 space-y-1 text-xs text-gray-500">
          <li>• Más verificaciones confirmadas aumentan tu bloque de confianza empresarial.</li>
          <li>• Evidencias vinculadas y orden temporal consistente mejoran la puntuación.</li>
          <li>• Cuando empresas reutilizan tus verificaciones, tu perfil gana señal adicional.</li>
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
            title="Idiomas y otros logros"
            summary={achievementsCount > 0 ? `${achievementsCount} logros o certificaciones registrados.` : "Añade certificaciones y logros para reforzar tu perfil profesional."}
            href="/candidate/achievements"
            cta="Gestionar"
          />
        </div>
      </section>
    </div>
  );
}
