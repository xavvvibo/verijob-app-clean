"use client";

import { useEffect, useMemo, useState } from "react";
import AvatarUploader from "@/components/profile/AvatarUploader";
import { createClient } from "@/utils/supabase/browser";
import TrustRingPro from "@/components/candidate/TrustRingPro";
import CredibilitySparkline from "@/components/candidate/CredibilitySparkline";

type ProfileLite = {
  full_name?: string | null;
  title?: string | null;
  location?: string | null;
  avatar_url?: string | null;
};

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: any;
  hint?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-semibold text-gray-900 mt-2 tabular-nums">{value}</div>
      {hint ? <div className="text-xs text-gray-500 mt-2">{hint}</div> : null}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full border border-gray-200 bg-white text-xs text-gray-700">
      {children}
    </span>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-end justify-between gap-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        {subtitle ? <p className="text-sm text-gray-500 mt-1">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cls =
    s.includes("verif") ? "bg-green-50 text-green-700 border-green-100" :
    s.includes("revis") || s.includes("pend") ? "bg-amber-50 text-amber-700 border-amber-100" :
    s.includes("rech") ? "bg-red-50 text-red-700 border-red-100" :
    "bg-gray-50 text-gray-700 border-gray-200";

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function ActionCard({
  title,
  desc,
  cta,
  onClick,
  tone = "primary",
}: {
  title: string;
  desc: string;
  cta: string;
  onClick?: () => void;
  tone?: "primary" | "ghost";
}) {
  const btn =
    tone === "primary"
      ? "bg-blue-600 text-white hover:bg-blue-700"
      : "border border-gray-300 text-gray-700 hover:bg-gray-50";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex items-start justify-between gap-6">
      <div>
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <div className="text-sm text-gray-500 mt-2">{desc}</div>
      </div>
      <button
        onClick={onClick}
        className={`px-4 py-2 rounded-xl text-sm font-medium transition ${btn}`}
      >
        {cta}
      </button>
    </div>
  );
}

export default function CandidateOverview() {
  // Perfil real
  const [profile, setProfile] = useState<ProfileLite>({
    full_name: "Candidato",
    title: "Profesional",
    location: "España",
    avatar_url: null,
  });
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Datos “producto” (por ahora mock bien presentado; luego lo conectamos a verification_summary)
  const score = 86; // subimos a demo “wow”
  const breakdown = { real: 46, approved: 32, valid: 22 };
  const stats = {
    active: 4,
    pending: 1,
    shared: 7,
    views: 31,
    avgValidation: "2.1 días",
    companiesVerified: 3,
  };

  const credibilityTrend = [62, 64, 63, 66, 69, 71, 73, 74, 76, 78, 80, 82, 83, 84, 86];

  const experiences = [
    { company: "Restaurante Central", role: "Camarero", dates: "2023 — 2025", status: "Verificado", confidence: "Alta" },
    { company: "Hotel Sol", role: "Ayudante de sala", dates: "2022 — 2023", status: "En revisión", confidence: "Media" },
    { company: "Cafetería Plaza", role: "Barista", dates: "2020 — 2022", status: "Verificado", confidence: "Alta" },
  ];

  const activity = [
    { when: "Hoy", what: "Tu perfil fue consultado por una empresa", tone: "good" as const },
    { when: "Ayer", what: "Nueva evidencia subida en Hotel Sol", tone: "warn" as const },
    { when: "Hace 3 días", what: "Restaurante Central confirmó tu experiencia", tone: "good" as const },
  ];

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

  const name = profile.full_name ?? "Candidato";
  const title = profile.title ?? "Profesional";
  const location = profile.location ?? "España";

  const headline = useMemo(() => {
    // Microcopy “premium” según score (demo-ready)
    if (score >= 85) return "Perfil listo para compartir en procesos de selección exigentes.";
    if (score >= 70) return "Estás muy cerca del nivel máximo. Completa 1 verificación más.";
    return "Empieza por tu experiencia más reciente para elevar tu credibilidad.";
  }, [score]);

  const nextActions = useMemo(() => {
    const a: Array<{ t: string; d: string; c: string; tone?: "primary" | "ghost" }> = [];
    if (!profile.avatar_url) {
      a.push({
        t: "Completa tu identidad profesional",
        d: "Sube una foto profesional. Aumenta confianza y prepara tu CV verificado.",
        c: "Subir foto",
        tone: "primary",
      });
    }
    a.push({
      t: "Añade tu experiencia más reciente",
      d: "Una verificación adicional suele subir tu score entre 4–8 puntos.",
      c: "Añadir verificación",
      tone: "primary",
    });
    a.push({
      t: "Comparte tu perfil verificado",
      d: "Comparte un enlace seguro con una empresa para acelerar validación.",
      c: "Compartir",
      tone: "ghost",
    });
    return a.slice(0, 3);
  }, [profile.avatar_url]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Background subtle (enterprise, no gradient agresivo) */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="h-72 bg-gradient-to-b from-blue-50/60 to-transparent" />
      </div>

      <div className="relative px-8 py-10">
        <div className="max-w-7xl mx-auto space-y-12">

          {/* TOP identity row */}
          <div className="flex flex-col lg:flex-row items-start justify-between gap-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Pill>Identidad profesional</Pill>
                <Pill>Perfil verificable</Pill>
                <Pill>Listo para CV</Pill>
              </div>
              <div className="text-sm text-gray-600">
                {headline}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition">
                Compartir perfil
              </button>
              <button
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
                title="Siguiente fase: CV PDF verificado desde Verijob"
              >
                Descargar CV (próximo)
              </button>
            </div>
          </div>

          {/* HERO */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">

              <div className="lg:col-span-7">
                <TrustRingPro score={score} breakdown={breakdown} />
                <div className="mt-8 bg-gray-50 border border-gray-200 rounded-2xl p-6">
                  <CredibilitySparkline points={credibilityTrend} />
                </div>
              </div>

              <div className="lg:col-span-5 space-y-6">
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                  <div className="text-sm font-semibold text-gray-900">Tu perfil</div>
                  <div className="mt-4">
                    <AvatarUploader
                      currentUrl={profile.avatar_url ?? null}
                      fallbackName={name}
                      onUpdated={(url) => setProfile((p) => ({ ...p, avatar_url: url }))}
                    />
                  </div>

                  <div className="mt-6">
                    <div className="text-2xl font-semibold text-gray-900">
                      {loadingProfile ? "Cargando…" : name}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">{title}</div>
                    <div className="text-xs text-gray-500 mt-1">{location}</div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="text-xs text-gray-500">Empresas verificadas</div>
                      <div className="text-lg font-semibold text-gray-900 mt-1 tabular-nums">
                        {stats.companiesVerified}
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="text-xs text-gray-500">Tiempo medio</div>
                      <div className="text-lg font-semibold text-gray-900 mt-1 tabular-nums">
                        {stats.avgValidation}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-semibold text-gray-900">Acciones recomendadas</div>
                  <div className="space-y-3">
                    {nextActions.map((a, idx) => (
                      <ActionCard
                        key={idx}
                        title={a.t}
                        desc={a.d}
                        cta={a.c}
                        tone={a.tone}
                        onClick={() => {
                          // Hook: luego conectamos a modals/flows reales
                          console.log("action:", a.t);
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* STATS */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <StatCard label="Verificaciones activas" value={stats.active} hint="Experiencias ya en tu perfil" />
            <StatCard label="Pendientes" value={stats.pending} hint="En proceso de confirmación" />
            <StatCard label="Compartidos activos" value={stats.shared} hint="Enlaces enviados a empresas" />
            <StatCard label="Visualizaciones" value={stats.views} hint="Interés reciente (30 días)" />
            <StatCard label="Tiempo medio validación" value={stats.avgValidation} hint="Basado en tu historial" />
          </div>

          {/* EXPERIENCE */}
          <div className="space-y-6">
            <SectionTitle
              title="Experiencia verificada"
              subtitle="Una vista profesional: clara para ti y potente para compartir."
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Timeline */}
              <div className="lg:col-span-2 space-y-4">
                {experiences.map((exp, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-6">
                      <div>
                        <div className="text-lg font-semibold text-gray-900">{exp.company}</div>
                        <div className="text-sm text-gray-600 mt-1">{exp.role}</div>
                        <div className="text-xs text-gray-500 mt-2">{exp.dates}</div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <StatusBadge status={exp.status} />
                        <Pill>Confianza: {exp.confidence}</Pill>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition">
                        Ver detalle
                      </button>
                      <button className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition">
                        Añadir evidencia
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Activity */}
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                  <div className="text-sm font-semibold text-gray-900">Actividad</div>
                  <div className="mt-4 space-y-3">
                    {activity.map((a, i) => {
                      const dot =
                        a.tone === "good" ? "bg-green-500" :
                        a.tone === "warn" ? "bg-amber-500" :
                        "bg-gray-400";
                      return (
                        <div key={i} className="flex gap-3">
                          <div className="mt-1.5">
                            <span className={`inline-block w-2.5 h-2.5 rounded-full ${dot}`} />
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">{a.when}</div>
                            <div className="text-sm text-gray-700">{a.what}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-5">
                    <button className="text-blue-600 text-sm font-medium hover:underline">
                      Ver historial completo
                    </button>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
                  <div className="text-sm font-semibold text-blue-900">Modo selección</div>
                  <div className="text-sm text-blue-700 mt-2">
                    Comparte tu perfil para que una empresa valide más rápido sin pedir documentos por WhatsApp.
                  </div>
                  <button className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition">
                    Compartir ahora
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* FOOTER CTA */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="text-lg font-semibold text-gray-900">Tu CV verificable está a un paso</div>
              <div className="text-sm text-gray-500 mt-1">
                En la siguiente mejora, generaremos un CV PDF “Verificado por Verijob” con tu foto y experiencias confirmadas.
              </div>
            </div>
            <button
              className="px-5 py-3 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
              title="Siguiente fase"
            >
              Activar CV verificado (próximo)
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
