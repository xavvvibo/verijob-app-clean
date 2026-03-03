"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/browser";
import AvatarUploader from "@/components/profile/AvatarUploader";

type ProfileLite = {
  full_name?: string | null;
  title?: string | null;
  location?: string | null;
  avatar_url?: string | null;
};

function scoreTone(score: number) {
  if (score >= 85) return { ring: "stroke-green-600", badge: "bg-green-50 text-green-700 border-green-100", label: "Profesional validado" };
  if (score >= 70) return { ring: "stroke-green-500", badge: "bg-green-50 text-green-700 border-green-100", label: "Alta confianza" };
  if (score >= 40) return { ring: "stroke-blue-600", badge: "bg-blue-50 text-blue-700 border-blue-100", label: "Verificado" };
  return { ring: "stroke-gray-400", badge: "bg-gray-50 text-gray-700 border-gray-200", label: "Inicial" };
}

function RingNoNumber({ score }: { score: number }) {
  const s = Math.max(0, Math.min(100, score));
  const radius = 92;
  const stroke = 14;
  const normalized = radius - stroke * 0.5;
  const circumference = normalized * 2 * Math.PI;
  const offset = circumference - (s / 100) * circumference;
  const tone = scoreTone(s);

  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
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

      {/* Sin número: solo nivel + microcopy */}
      <div className="absolute text-center px-6">
        <div className={`inline-flex px-3 py-1 rounded-full border text-xs font-semibold ${tone.badge}`}>
          {tone.label}
        </div>
        <div className="mt-3 text-sm text-gray-600 leading-snug">
          Credibilidad basada en verificaciones reales y evidencias consistentes.
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
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-3xl shadow-sm">
      {(title || subtitle || right) ? (
        <div className="px-6 pt-6 flex items-start justify-between gap-4">
          <div>
            {title ? <div className="text-sm font-semibold text-gray-900">{title}</div> : null}
            {subtitle ? <div className="mt-1 text-sm text-gray-500">{subtitle}</div> : null}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      ) : null}
      <div className={(title || subtitle || right) ? "px-6 pb-6 pt-4" : "p-6"}>
        {children}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: any; hint?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-gray-900 tabular-nums">{value}</div>
      {hint ? <div className="mt-2 text-xs text-gray-500">{hint}</div> : null}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cls =
    s.includes("verif") ? "bg-green-50 text-green-700 border-green-100" :
    s.includes("revis") || s.includes("pend") ? "bg-amber-50 text-amber-700 border-amber-100" :
    s.includes("rech") ? "bg-red-50 text-red-700 border-red-100" :
    "bg-gray-50 text-gray-700 border-gray-200";

  return (
    <span className={`inline-flex px-3 py-1 rounded-full border text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}

function ActionCard({
  title,
  desc,
  cta,
  tone = "primary",
}: {
  title: string;
  desc: string;
  cta: string;
  tone?: "primary" | "ghost";
}) {
  const btn =
    tone === "primary"
      ? "bg-blue-600 text-white hover:bg-blue-700"
      : "border border-gray-300 text-gray-700 hover:bg-gray-50";

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex items-start justify-between gap-5">
      <div>
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <div className="mt-2 text-sm text-gray-500">{desc}</div>
      </div>
      <button className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${btn}`}>
        {cta}
      </button>
    </div>
  );
}

export default function CandidateOverview() {
  const [profile, setProfile] = useState<ProfileLite>({
    full_name: "Candidato",
    title: "Profesional",
    location: "España",
    avatar_url: null,
  });
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: au } = await supabase.auth.getUser();
        if (!au.user) return;

        const { data, error } = await supabase
          .from("profiles")
          .select("full_name, title, location, avatar_url")
          .eq("id", au.user.id)
          .maybeSingle();

        if (!cancelled && !error && data) setProfile(data as ProfileLite);
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // MOCK PRO (siguiente paso: conectamos a verification_summary real)
  const score = 82;
  const stats = { active: 3, pending: 1, views30d: 18, shares30d: 5, avgValidation: "2.8 días" };
  const experiences = [
    { company: "Restaurante Central", role: "Camarero", dates: "2023 — 2025", status: "Verificado" },
    { company: "Hotel Sol", role: "Ayudante de sala", dates: "2022 — 2023", status: "En revisión" },
    { company: "Cafetería Plaza", role: "Barista", dates: "2020 — 2022", status: "Verificado" },
  ];

  const name = profile.full_name ?? "Candidato";
  const title = profile.title ?? "Profesional";
  const location = profile.location ?? "España";

  const headline = useMemo(() => {
    if (score >= 85) return "Perfil listo para procesos de selección exigentes.";
    if (score >= 70) return "Muy buen nivel. Completa 1 verificación más para subir al máximo.";
    if (score >= 40) return "Ya estás verificado. Consolidemos con evidencias consistentes.";
    return "Empieza por tu experiencia más reciente.";
  }, [score]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="absolute inset-0 pointer-events-none">
        <div className="h-64 bg-gradient-to-b from-blue-50/70 to-transparent" />
      </div>

      <div className="relative px-8 py-10">
        <div className="max-w-7xl mx-auto space-y-10">

          {/* Header “company-like” */}
          <div className="flex flex-col lg:flex-row items-start justify-between gap-6">
            <div>
              <div className="text-sm text-gray-500">Dashboard candidato</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">
                {loadingProfile ? "Cargando…" : name}
              </div>
              <div className="mt-1 text-sm text-gray-600">
                {title} · <span className="text-gray-500">{location}</span>
              </div>
              <div className="mt-3 text-sm text-gray-600">{headline}</div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition">
                Añadir verificación
              </button>
              <button className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition">
                Compartir perfil
              </button>
              <button className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition">
                CV verificado (próximo)
              </button>
            </div>
          </div>

          {/* Hero: Ring + Identidad + Next best action */}
          <Card>
            <div className="p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              <div className="lg:col-span-7">
                <RingNoNumber score={score} />
              </div>

              <div className="lg:col-span-5 space-y-6">
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                  <div className="text-sm font-semibold text-gray-900">Identidad</div>
                  <div className="mt-4">
                    <AvatarUploader
                      currentUrl={profile.avatar_url ?? null}
                      fallbackName={name}
                      onUpdated={(url) => setProfile((p) => ({ ...p, avatar_url: url }))}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-semibold text-gray-900">Acciones recomendadas</div>
                  <ActionCard
                    title="Añade una verificación reciente"
                    desc="Es la acción que más aumenta tu credibilidad. Ideal: 1 verificación + 1 evidencia."
                    cta="Añadir verificación"
                    tone="primary"
                  />
                  <ActionCard
                    title="Comparte tu perfil"
                    desc="Acelera validación enviando un enlace seguro a la empresa."
                    cta="Compartir"
                    tone="ghost"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* KPI strip como company */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
            <Stat label="Verificaciones activas" value={stats.active} hint="En tu perfil" />
            <Stat label="Pendientes" value={stats.pending} hint="En revisión" />
            <Stat label="Vistas (30d)" value={stats.views30d} hint="Interés reciente" />
            <Stat label="Shares (30d)" value={stats.shares30d} hint="Enlaces activos" />
            <Stat label="Tiempo medio" value={stats.avgValidation} hint="Histórico" />
          </div>

          {/* Panel principal: Experiencias (cards premium) */}
          <div className="flex items-end justify-between gap-6">
            <div>
              <div className="text-xl font-semibold text-gray-900">Experiencia verificable</div>
              <div className="mt-1 text-sm text-gray-500">
                Presentación clara para ti y potente para compartir con empresas.
              </div>
            </div>
            <button className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition">
              Ver todas
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {experiences.map((exp, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-3xl shadow-sm p-7">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <div className="text-lg font-semibold text-gray-900">{exp.company}</div>
                    <div className="mt-1 text-sm text-gray-600">{exp.role}</div>
                    <div className="mt-2 text-xs text-gray-500">{exp.dates}</div>
                  </div>
                  <StatusPill status={exp.status} />
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition">
                    Ver detalle
                  </button>
                  <button className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition">
                    Añadir evidencia
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer CTA */}
          <Card>
            <div className="p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <div className="text-lg font-semibold text-gray-900">CV verificado (siguiente nivel)</div>
                <div className="mt-1 text-sm text-gray-500">
                  Generaremos un PDF “Verificado por Verijob” con tu foto y experiencias confirmadas.
                </div>
              </div>
              <button className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition">
                Activar CV (próximo)
              </button>
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}
