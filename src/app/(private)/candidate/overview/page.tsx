"use client";

import { useEffect, useMemo, useState } from "react";
import PublicCvLinkButton from "@/components/public/PublicCvLinkButton";
import { createClient } from "@/utils/supabase/browser";
import AvatarUploader from "@/components/profile/AvatarUploader";

type ProfileLite = {
  full_name?: string | null;
  title?: string | null;
  location?: string | null;
  avatar_url?: string | null;
};

type VerificationRow = {
  verification_id: string;
  company_id: string | null;
  candidate_id: string | null;
  status: string | null;
  company_confirmed: boolean | null;
  evidence_count: number | null;
  actions_count: number | null;
  company_name_freeform: string | null;
  position: string | null;
  start_date: string | null;
  end_date: string | null;
  is_revoked?: boolean | null;
  revoked_at?: string | null;
};

type TimelineItem = {
  source: "cv" | "verification";
  verification_id?: string;
  company: string | null;
  position: string | null;
  start: string | null;
  end: string | null;
  status?: string | null;
  company_confirmed?: boolean | null;
  evidence_count?: number | null;
  actions_count?: number | null;
  is_revoked?: boolean | null;
  revoked_at?: string | null;
  missing_fields?: string[];
};

type EducationItem = {
  institution: string | null;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  description?: string | null;
};

type AchievementItem = {
  title: string | null;
  issuer?: string | null;
  date?: string | null;
  description?: string | null;
};

type CandidateProfilePayload = Record<string, any> | null;

type OnboardingItem = {
  key: string;
  label: string;
  done: boolean;
  hint: string;
  href: string;
  cta: string;
};

function clamp(n: number, a = 0, b = 100) {
  return Math.max(a, Math.min(b, n));
}

function goTo(href: string) {
  window.location.href = href;
}

function scoreTone(score: number) {
  if (score >= 80) return { ring: "stroke-green-600", badge: "bg-green-50 text-green-700 border-green-100", label: "Alta confianza" };
  if (score >= 45) return { ring: "stroke-blue-600", badge: "bg-blue-50 text-blue-700 border-blue-100", label: "Confianza media" };
  return { ring: "stroke-amber-500", badge: "bg-amber-50 text-amber-800 border-amber-200", label: "Confianza inicial" };
}

function RingNoNumber({ score }: { score: number }) {
  const s = clamp(score);
  const radius = 68;
  const stroke = 10;
  const normalized = radius - stroke * 0.5;
  const circumference = normalized * 2 * Math.PI;
  const offset = circumference - (s / 100) * circumference;
  const tone = scoreTone(s);

  return (
    <div className="relative w-44 h-44 flex items-center justify-center">
      <svg height="168" width="168" className="rotate-[-90deg]">
        <circle stroke="#e5e7eb" fill="transparent" strokeWidth={stroke} r={normalized} cx="84" cy="84" />
        <circle
          strokeLinecap="round"
          className={`${tone.ring} transition-all duration-700`}
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          r={normalized}
          cx="84"
          cy="84"
        />
      </svg>

      <div className="absolute text-center px-4">
        <div className="text-2xl font-semibold text-gray-900 tabular-nums">{s}%</div>
        <div className={`inline-flex px-3 py-1 rounded-full border text-xs font-semibold ${tone.badge}`}>
          {tone.label}
        </div>
        <div className="mt-2 text-xs text-gray-600 leading-snug">
          Credibilidad basada en verificaciones y evidencias.
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  subtitle,
  right,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white border border-gray-200 rounded-3xl shadow-sm ${className}`}>
      {(title || subtitle || right) ? (
        <div className="px-7 pt-7 flex items-start justify-between gap-4">
          <div>
            {title ? <div className="text-sm font-semibold text-gray-900">{title}</div> : null}
            {subtitle ? <div className="mt-1 text-sm text-gray-500">{subtitle}</div> : null}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      ) : null}
      <div className={(title || subtitle || right) ? "px-7 pb-7 pt-4" : "p-7"}>{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="h-full bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between min-h-[108px]">
      <div className="text-xs text-gray-500 leading-5">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-gray-900 tabular-nums leading-none">{value}</div>
    </div>
  );
}

function StatusPill({ status, revoked }: { status: string; revoked?: boolean }) {
  if (revoked) {
    return (
      <span className="inline-flex px-3 py-1 rounded-full border text-xs font-semibold bg-red-50 text-red-700 border-red-100">
        Revocada
      </span>
    );
  }

  const s = (status || "").toLowerCase();
  const cls =
    s.includes("approved") || s.includes("verified") ? "bg-green-50 text-green-700 border-green-100" :
    s.includes("review") || s.includes("pending") ? "bg-amber-50 text-amber-700 border-amber-100" :
    s.includes("reject") ? "bg-red-50 text-red-700 border-red-100" :
    "bg-gray-50 text-gray-700 border-gray-200";

  const label =
    s.includes("approved") ? "Aprobada" :
    s.includes("rejected") ? "Rechazada" :
    s.includes("review") ? "En revisión" :
    s.includes("pending") ? "Pendiente" :
    status || "—";

  return (
    <span className={`inline-flex px-3 py-1 rounded-full border text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function PrimaryButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 text-sm font-semibold hover:bg-gray-50 transition"
    >
      {children}
    </button>
  );
}

function TertiaryButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 text-sm font-semibold hover:bg-gray-100 transition"
    >
      {children}
    </button>
  );
}

function computeScore(verifications: VerificationRow[]) {
  const total = verifications.length;
  const verified = verifications.filter(v => {
    const s = (v.status || "").toLowerCase();
    return s === "approved" || s === "verified";
  }).length;
  const confirmed = verifications.filter(v => !!v.company_confirmed).length;
  const evidences = verifications.reduce((acc, v) => acc + (v.evidence_count || 0), 0);

  const R = total > 0 ? verified / total : 0;
  const V = total > 0 ? confirmed / total : 0;
  const A = total > 0 ? Math.min(1, evidences / (total * 2)) : 0;

  const score = Math.round((R * 0.5 + V * 0.3 + A * 0.2) * 100);
  const completion = clamp(
    (total > 0 ? 40 : 0) +
      (verified > 0 ? 30 : 0) +
      (evidences > 0 ? 20 : 0),
    0,
    100
  );

  return { total, verified, confirmed, evidences, score, completion };
}

function fmtRange(start: string | null, end: string | null) {
  const s = start ? String(start).slice(0, 10) : null;
  const e = end ? String(end).slice(0, 10) : null;
  if (s && e) return `${s} → ${e}`;
  if (s && !e) return `${s} → Actualidad`;
  if (!s && e) return `Hasta ${e}`;
  return "Fechas no disponibles";
}

function pickArray(obj: CandidateProfilePayload, keys: string[]) {
  if (!obj) return [];
  for (const key of keys) {
    const value = obj[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function normalizeEducation(raw: any[]): EducationItem[] {
  return raw
    .map((item) => ({
      institution: item?.institution ?? item?.school ?? item?.center ?? item?.entity ?? null,
      title: item?.title ?? item?.degree ?? item?.qualification ?? item?.name ?? null,
      start_date: item?.start_date ?? item?.start ?? null,
      end_date: item?.end_date ?? item?.end ?? null,
      description: item?.description ?? item?.notes ?? null,
    }))
    .filter((x) => x.institution || x.title || x.start_date || x.end_date);
}

function normalizeAchievements(raw: any[]): AchievementItem[] {
  return raw
    .map((item) => ({
      title: item?.title ?? item?.name ?? item?.achievement ?? item?.label ?? null,
      issuer: item?.issuer ?? item?.entity ?? item?.organization ?? null,
      date: item?.date ?? item?.issued_at ?? item?.year ?? null,
      description: item?.description ?? item?.notes ?? null,
    }))
    .filter((x) => x.title || x.issuer || x.date || x.description);
}

function extractSummary(profileData: CandidateProfilePayload) {
  if (!profileData) return null;
  return profileData.summary ?? profileData.bio ?? profileData.about ?? null;
}

function extractPersonalFields(profileData: CandidateProfilePayload) {
  if (!profileData) {
    return {
      email: null,
      phone: null,
      website: null,
      linkedin: null,
      location: null,
    };
  }

  return {
    email: profileData.email ?? null,
    phone: profileData.phone ?? profileData.phone_number ?? null,
    website: profileData.website ?? profileData.portfolio_url ?? null,
    linkedin: profileData.linkedin ?? profileData.linkedin_url ?? null,
    location: profileData.location ?? null,
  };
}

function progressItems(args: {
  profile: ProfileLite | null;
  candidateProfile: CandidateProfilePayload;
  hasExperience: boolean;
  hasEducation: boolean;
  hasAchievements: boolean;
  hasVerifications: boolean;
  hasEvidence: boolean;
}) {
  const personal = extractPersonalFields(args.candidateProfile);
  const profileDone = !!(
    args.profile?.full_name ||
    args.profile?.title ||
    args.profile?.location ||
    personal.email ||
    personal.phone ||
    personal.linkedin ||
    personal.website
  );

  const items: OnboardingItem[] = [
    {
      key: "personal",
      label: "Completa tus datos personales",
      done: profileDone,
      hint: profileDone ? "Base personal detectada" : "Añade nombre, ubicación y contacto",
      href: "/candidate/profile",
      cta: "Editar",
    },
    {
      key: "experience",
      label: "Estructura tu experiencia laboral",
      done: args.hasExperience,
      hint: args.hasExperience ? "Experiencia detectada" : "Sube CV o crea verificaciones",
      href: "/candidate/experience",
      cta: "Gestionar",
    },
    {
      key: "education",
      label: "Incluye tu formación académica",
      done: args.hasEducation,
      hint: args.hasEducation ? "Formación detectada" : "Añade estudios para reforzar tu perfil",
      href: "/candidate/profile",
      cta: "Editar",
    },
    {
      key: "evidence",
      label: "Sube evidencias y valida tu historial",
      done: args.hasVerifications || args.hasEvidence,
      hint: (args.hasVerifications || args.hasEvidence) ? "Ya hay señales verificables" : "Crea verificaciones o sube evidencias",
      href: "/candidate/evidence",
      cta: "Abrir",
    },
  ];

  const completed = items.filter((x) => x.done).length;
  const percent = Math.round((completed / items.length) * 100);

  return { items, completed, percent };
}

export default function CandidateOverview() {
  const [loading, setLoading] = useState(true);

  const [cvScore, setCvScore] = useState<number>(0);
  const [cvExperiences, setCvExperiences] = useState<any[]>([]);
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfilePayload>(null);

  const [reuseEvents, setReuseEvents] = useState<number>(0);
  const [reuseCompanies, setReuseCompanies] = useState<number>(0);
  const [rows, setRows] = useState<VerificationRow[]>([]);
  const [trustScore, setTrustScore] = useState<number | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);

  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const supabase = createClient();

        const { data: au, error: auErr } = await supabase.auth.getUser();
        if (auErr) throw auErr;
        if (!au?.user?.id) {
          window.location.href = "/login";
          return;
        }

        const userId = au.user.id;

        const { data: p, error: pErr } = await supabase
          .from("profiles")
          .select("full_name, title, location, avatar_url")
          .eq("id", userId)
          .maybeSingle();

        if (pErr) throw pErr;

        const { data, error } = await supabase
          .from("verification_summary")
          .select("verification_id, company_id, candidate_id, status, company_confirmed, evidence_count, actions_count, company_name_freeform, position, start_date, end_date, is_revoked, revoked_at")
          .eq("candidate_id", userId);

        if (error) throw error;

        if (!alive) return;
        setProfile((p || null) as ProfileLite | null);

        const verificationIds = (data ?? []).map((r: any) => r.verification_id).filter(Boolean);
        if (verificationIds.length) {
          const { data: reData, error: reErr } = await supabase
            .from("verification_reuse_events")
            .select("verification_id, company_id")
            .in("verification_id", verificationIds);

          if (!reErr && reData) {
            setReuseEvents(reData.length);
            const uniq = new Set((reData as any[]).map((x) => x.company_id).filter(Boolean));
            setReuseCompanies(uniq.size);
          }
        } else {
          setReuseEvents(0);
          setReuseCompanies(0);
        }

        setRows((data || []) as VerificationRow[]);
        setErr(null);

        try {
          const r0 = await fetch("/api/candidate/profile", { credentials: "include" });
          const j0 = await r0.json();
          if (alive) setCandidateProfile(j0?.profile ?? null);
        } catch {}

        try {
          const r = await fetch("/api/candidate/trust-score", { credentials: "include" });
          const j = await r.json();
          if (alive && typeof j?.trust_score === "number") setTrustScore(j.trust_score);
        } catch {}

        try {
          const r2 = await fetch("/api/candidate/timeline", { credentials: "include" });
          const j2 = await r2.json();
          if (alive && Array.isArray(j2?.items)) setTimeline(j2.items as TimelineItem[]);
        } catch {}

        try {
          const r3 = await fetch("/api/candidate/cv", { credentials: "include" });
          if (r3.ok) {
            const j3 = await r3.json();
            if (alive) {
              setCvScore(typeof j3?.score === "number" ? j3.score : 0);
              setCvExperiences(Array.isArray(j3?.experiences) ? j3.experiences : []);
            }
          }
        } catch {}
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Error cargando datos");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const metrics = useMemo(() => {
    const m = computeScore(rows);
    const nameBonus = profile?.full_name ? 10 : 0;
    const reuseBonus = reuseCompanies >= 3 ? 20 : reuseCompanies >= 1 ? 10 : 0;
    const completion = clamp(m.completion + nameBonus);
    const ravScore = clamp(m.score + reuseBonus);
    const displayScore = trustScore != null ? clamp(trustScore) : ravScore;
    return { ...m, ravScore, score: displayScore, completion };
  }, [rows, profile?.full_name, reuseCompanies, trustScore]);

  const recent = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const da = (a.end_date || a.start_date || "") as string;
      const db = (b.end_date || b.start_date || "") as string;
      return (db || "").localeCompare(da || "");
    });
    return copy.slice(0, 6);
  }, [rows]);

  const personal = useMemo(() => extractPersonalFields(candidateProfile), [candidateProfile]);
  const education = useMemo(
    () =>
      normalizeEducation(
        pickArray(candidateProfile, [
          "education",
          "educations",
          "academic_records",
          "academic_history",
          "academic_items",
          "studies",
          "training",
        ])
      ),
    [candidateProfile]
  );

  const achievements = useMemo(
    () =>
      normalizeAchievements(
        pickArray(candidateProfile, [
          "achievements",
          "other_achievements",
          "awards",
          "certifications",
          "licenses",
          "honors",
          "milestones",
        ])
      ),
    [candidateProfile]
  );

  const summary = useMemo(() => extractSummary(candidateProfile), [candidateProfile]);

  const experienceItems = useMemo(() => {
    if (timeline.length > 0) {
      return timeline.slice(0, 8).map((item, idx) => ({
        key: `${item.verification_id || item.source}-${idx}`,
        title: item.position || "Puesto",
        subtitle: item.company || "Empresa",
        range: fmtRange(item.start, item.end),
        description: null as string | null,
        verified: item.source === "verification" && (!!item.company_confirmed || (item.status || "").toLowerCase() === "verified" || (item.status || "").toLowerCase() === "approved"),
        source: item.source,
        revoked: !!item.is_revoked,
      }));
    }

    if (cvExperiences.length > 0) {
      return cvExperiences.slice(0, 8).map((exp: any, idx: number) => ({
        key: `cv-${idx}`,
        title: exp?.role_title || "Puesto",
        subtitle: exp?.company_name || "Empresa",
        range: fmtRange(exp?.start_date || null, exp?.end_date || null),
        description: exp?.description || null,
        verified: !!exp?.matched_verification_id,
        source: "cv",
        revoked: false,
      }));
    }

    return recent.slice(0, 8).map((v) => ({
      key: v.verification_id,
      title: v.position || "Puesto",
      subtitle: v.company_name_freeform || "Empresa",
      range: fmtRange(v.start_date, v.end_date),
      description: null as string | null,
      verified: !!v.company_confirmed || ["verified", "approved"].includes((v.status || "").toLowerCase()),
      source: "verification",
      revoked: !!v.is_revoked,
    }));
  }, [timeline, cvExperiences, recent]);

  const onboarding = useMemo(
    () =>
      progressItems({
        profile,
        candidateProfile,
        hasExperience: experienceItems.length > 0,
        hasEducation: education.length > 0,
        hasAchievements: achievements.length > 0,
        hasVerifications: rows.length > 0,
        hasEvidence: metrics.evidences > 0,
      }),
    [profile, candidateProfile, experienceItems.length, education.length, achievements.length, rows.length, metrics.evidences]
  );

  const tone = scoreTone(metrics.score);
  const otherAchievementsCollapsed = achievements.length === 0;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-3xl shadow-sm p-7 flex flex-col lg:flex-row lg:items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-4">
            <AvatarUploader
              currentUrl={profile?.avatar_url ?? ""}
              fallbackName={profile?.full_name ?? "Candidato"}
              sizeClass="h-28 w-28"
            />
            <div className="min-w-0">
          <div className="text-xs text-gray-500">Dashboard candidato</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900 truncate">
            {profile?.full_name ? profile.full_name : "Tu credibilidad profesional"}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
            <div className="inline-flex items-center gap-1">
              <span>Progreso perfil:</span>
              <span className="font-semibold tabular-nums text-gray-900">{onboarding.percent}%</span>
            </div>
            <div className="inline-flex items-center gap-1">
              <span>R/A/V:</span>
              <span className="font-semibold tabular-nums text-gray-900">{metrics.ravScore}%</span>
            </div>
            <div className="inline-flex items-center gap-1">
              <span>Trust:</span>
              <span className="font-semibold tabular-nums text-gray-900">{metrics.score}%</span>
            </div>
          </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <PrimaryButton onClick={() => goTo("/candidate/verifications/new")}>
              Crear verificación
            </PrimaryButton>
            <SecondaryButton onClick={() => goTo("/candidate/evidence")}>
              Subir evidencias
            </SecondaryButton>
            <SecondaryButton onClick={() => goTo("/candidate/profile-share")}>
              Compartir perfil
            </SecondaryButton>
          </div>

          {err ? <div className="mt-4 text-sm text-red-600">{err}</div> : null}
          {loading ? <div className="mt-4 text-sm text-gray-500">Cargando datos…</div> : null}
        </div>

        <div className="flex flex-col items-start lg:items-end gap-3 shrink-0">
          <div className={`inline-flex px-3 py-1 rounded-full border text-xs font-semibold ${tone.badge}`}>
            {tone.label}
          </div>
          <div className="text-xs text-gray-500">Trust Score: <span className="font-semibold text-gray-900 tabular-nums">{metrics.score}%</span></div>
        </div>
      </div>

      <Card
        title="Onboarding guiado"
        subtitle="Completa tu CV estructurado y mejora la credibilidad del perfil"
        right={<span className="text-xs text-gray-500">{onboarding.percent}% completado</span>}
      >
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          {onboarding.items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => goTo(item.href)}
              className={`rounded-2xl border p-4 text-left transition hover:shadow-sm ${
                item.done ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50 hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-900">{item.label}</div>
                <span
                  className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold ${
                    item.done ? "bg-green-600 text-white" : "bg-white text-gray-600 border border-gray-200"
                  }`}
                >
                  {item.done ? "OK" : "·"}
                </span>
              </div>
              <div className="mt-2 text-xs text-gray-600">{item.hint}</div>
              <div className="mt-3 text-xs font-semibold text-blue-600">{item.cta}</div>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card
          title="Credibilidad"
          subtitle="Basada en verificaciones reales"
          right={<span className="text-xs text-gray-500">Trust Score</span>}
          className="xl:col-span-1"
        >
          <div className="flex items-center justify-center">
            <RingNoNumber score={metrics.score} />
          </div>
        </Card>

        <div className="xl:col-span-2 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Stat label="Verificaciones" value={metrics.total} />
            <Stat label="Aprobadas" value={metrics.verified} />
            <Stat label="Confirmadas" value={metrics.confirmed} />
            <Stat label="Evidencias" value={metrics.evidences} />
            <Stat label="Reutilizaciones" value={reuseEvents} />
            <Stat label="Empresas (reuse)" value={reuseCompanies} />
          </div>

          <Card
            title="CV estructurado"
            subtitle="Tus bloques clave para construir y compartir un perfil profesional claro"
            right={<span className="text-xs text-gray-500">Procesamiento automático + señales reales</span>}
          >
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div className="rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">1) Datos personales</div>
                      <div className="mt-1 text-xs text-gray-500">Identidad profesional base del perfil</div>
                    </div>
                    <TertiaryButton onClick={() => goTo("/candidate/profile")}>Editar</TertiaryButton>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div>
                      <div className="text-xs text-gray-500">Nombre</div>
                      <div className="text-sm text-gray-900">{profile?.full_name || "Pendiente"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Título profesional</div>
                      <div className="text-sm text-gray-900">{profile?.title || candidateProfile?.title || "Pendiente"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Ubicación</div>
                      <div className="text-sm text-gray-900">{profile?.location || personal.location || "Pendiente"}</div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-gray-500">Email</div>
                        <div className="text-sm text-gray-900 break-all">{personal.email || "Pendiente"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Teléfono</div>
                        <div className="text-sm text-gray-900">{personal.phone || "Pendiente"}</div>
                      </div>
                    </div>
                    {(personal.linkedin || personal.website) ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs text-gray-500">LinkedIn</div>
                          <div className="text-sm text-gray-900 break-all">{personal.linkedin || "—"}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Web / portfolio</div>
                          <div className="text-sm text-gray-900 break-all">{personal.website || "—"}</div>
                        </div>
                      </div>
                    ) : null}
                    {summary ? (
                      <div>
                        <div className="text-xs text-gray-500">Resumen profesional</div>
                        <div className="mt-1 text-sm text-gray-700">{summary}</div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">2) Experiencia laboral</div>
                      <div className="mt-1 text-xs text-gray-500">Timeline + verificaciones + CV estructurado</div>
                    </div>
                    <TertiaryButton onClick={() => goTo("/candidate/experience")}>Gestionar</TertiaryButton>
                  </div>

                  <div className="mt-2 text-xs text-gray-500">
                    {cvExperiences.length > 0 ? `CV score ${cvScore}` : `${experienceItems.length} items`}
                  </div>

                  {experienceItems.length === 0 ? (
                    <div className="mt-4 rounded-2xl bg-gray-50 border border-gray-200 p-4 text-sm text-gray-600">
                      Todavía no hay experiencia estructurada. Sube tu CV o crea una verificación para empezar.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {experienceItems.map((item) => (
                        <div key={item.key} className="rounded-2xl border border-gray-200 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-gray-900">{item.title}</div>
                              <div className="text-sm text-gray-600">{item.subtitle}</div>
                              <div className="mt-1 text-xs text-gray-500">{item.range}</div>
                            </div>
                            <div className="shrink-0 flex flex-wrap items-center gap-2">
                              {item.revoked ? (
                                <span className="inline-flex px-2.5 py-1 rounded-full border text-[11px] font-semibold bg-red-50 text-red-700 border-red-100">
                                  Revocada
                                </span>
                              ) : item.verified ? (
                                <span className="inline-flex px-2.5 py-1 rounded-full border text-[11px] font-semibold bg-green-50 text-green-700 border-green-100">
                                  Verificada
                                </span>
                              ) : (
                                <span className="inline-flex px-2.5 py-1 rounded-full border text-[11px] font-semibold bg-gray-50 text-gray-700 border-gray-200">
                                  CV
                                </span>
                              )}
                            </div>
                          </div>
                          {item.description ? (
                            <div className="mt-2 text-sm text-gray-700">{item.description}</div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">3) Datos académicos</div>
                      <div className="mt-1 text-xs text-gray-500">Formación reglada, cursos o especializaciones relevantes</div>
                    </div>
                    <TertiaryButton onClick={() => goTo("/candidate/profile")}>Editar</TertiaryButton>
                  </div>

                  {education.length === 0 ? (
                    <div className="mt-4 rounded-2xl bg-blue-50 border border-blue-100 p-4">
                      <div className="text-sm font-semibold text-blue-900">
                        Incluye tu formación académica y verifícala
                      </div>
                      <div className="mt-1 text-sm text-blue-800">
                        Esta sección aún está vacía. Añadir estudios mejora la solidez y lectura del CV.
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {education.map((item, idx) => (
                        <div key={`${item.institution || "edu"}-${idx}`} className="rounded-2xl border border-gray-200 p-4">
                          <div className="text-sm font-semibold text-gray-900">{item.title || "Formación"}</div>
                          <div className="text-sm text-gray-600">{item.institution || "Centro"}</div>
                          <div className="mt-1 text-xs text-gray-500">{fmtRange(item.start_date, item.end_date)}</div>
                          {item.description ? (
                            <div className="mt-2 text-sm text-gray-700">{item.description}</div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">4) Otros logros</div>
                      <div className="mt-1 text-xs text-gray-500">Certificaciones, premios, hitos y señales complementarias</div>
                    </div>
                    <TertiaryButton onClick={() => goTo("/candidate/profile")}>Editar</TertiaryButton>
                  </div>

                  <div className="mt-2 text-xs text-gray-500">
                    {otherAchievementsCollapsed ? "Minimizado" : `${achievements.length} items`}
                  </div>

                  {otherAchievementsCollapsed ? (
                    <div className="mt-4 rounded-2xl bg-gray-50 border border-dashed border-gray-200 p-4">
                      <div className="text-sm font-medium text-gray-700">
                        Sin contenido por ahora
                      </div>
                      <div className="mt-1 text-sm text-gray-500">
                        La sección queda minimizada y no debería tener protagonismo en el perfil público hasta que añadas información.
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {achievements.map((item, idx) => (
                        <div key={`${item.title || "achievement"}-${idx}`} className="rounded-2xl border border-gray-200 p-4">
                          <div className="text-sm font-semibold text-gray-900">{item.title || "Logro"}</div>
                          {(item.issuer || item.date) ? (
                            <div className="mt-1 text-sm text-gray-600">
                              {[item.issuer, item.date].filter(Boolean).join(" · ")}
                            </div>
                          ) : null}
                          {item.description ? (
                            <div className="mt-2 text-sm text-gray-700">{item.description}</div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card
            title="Timeline verificada"
            subtitle="CV + verificaciones + reutilización"
            right={<span className="text-xs text-gray-500">{timeline.length} items</span>}
          >
            {timeline.length === 0 ? (
              <div className="text-sm text-gray-600">
                Aún no hay timeline. Sube tu CV o crea verificaciones para construir tu historial.
              </div>
            ) : (
              <div className="space-y-3">
                {timeline.slice(0, 8).map((t, idx) => (
                  <div
                    key={(t.verification_id || "") + idx}
                    className="flex items-start justify-between gap-4 border border-gray-200 rounded-2xl p-4"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {(t.position || "Puesto")} · {(t.company || "Empresa")}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {fmtRange(t.start, t.end)}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {t.is_revoked ? (
                          <span className="inline-flex px-2.5 py-1 rounded-full border text-[11px] font-semibold bg-red-50 text-red-700 border-red-100">
                            ⛔ Revocada
                          </span>
                        ) : null}

                        {t.source === "verification" && !t.is_revoked && (t.status === "verified" || t.status === "approved" || t.company_confirmed) ? (
                          <span className="inline-flex px-2.5 py-1 rounded-full border text-[11px] font-semibold bg-green-50 text-green-700 border-green-100">
                            ✔ Verificada
                          </span>
                        ) : null}

                        {t.source === "verification" && t.company_confirmed ? (
                          <span className="inline-flex px-2.5 py-1 rounded-full border text-[11px] font-semibold bg-blue-50 text-blue-700 border-blue-100">
                            🏢 Confirmada
                          </span>
                        ) : null}

                        {t.source === "verification" ? (
                          <span className="inline-flex px-2.5 py-1 rounded-full border text-[11px] font-semibold bg-gray-50 text-gray-700 border-gray-200">
                            📄 Evidencias: {t.evidence_count || 0}
                          </span>
                        ) : (
                          <span className="inline-flex px-2.5 py-1 rounded-full border text-[11px] font-semibold bg-gray-50 text-gray-700 border-gray-200">
                            CV
                          </span>
                        )}

                        {t.source === "verification" ? (
                          <span className="inline-flex px-2.5 py-1 rounded-full border text-[11px] font-semibold bg-gray-50 text-gray-700 border-gray-200">
                            ♻ Acciones: {t.actions_count || 0}
                          </span>
                        ) : null}

                        {t.missing_fields && t.missing_fields.length ? (
                          <span className="inline-flex px-2.5 py-1 rounded-full border text-[11px] font-semibold bg-amber-50 text-amber-800 border-amber-100">
                            ⚠ Datos incompletos
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-3">
                      {t.source === "verification" ? (
                        <>
                          <StatusPill status={(t.status || "—")} revoked={!!t.is_revoked} />
                          {t.verification_id ? (
                            <>
                              <button
                                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                                onClick={() => (window.location.href = `/candidate/verification/${t.verification_id}`)}
                              >
                                Ver
                              </button>
                              <PublicCvLinkButton verificationId={t.verification_id} />
                            </>
                          ) : null}
                        </>
                      ) : (
                        <span className="inline-flex px-3 py-1 rounded-full border text-xs font-semibold bg-gray-50 text-gray-700 border-gray-200">
                          CV
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
