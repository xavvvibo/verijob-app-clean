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

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-3xl shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: any;
  hint?: string;
}) {
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

  return <span className={`inline-flex px-3 py-1 rounded-full border text-xs font-semibold ${cls}`}>{status}</span>;
}

export default function CandidateOverview() {
  // Perfil real (ya lo tienes)
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

  // Datos producto (hoy mock; luego lo conectamos a verification_summary real)
  const score = 82;
  const breakdown = { real: 40, approved: 30, valid: 30 };
  const trend = [62, 64, 63, 66, 69, 71, 73, 74, 76, 78, 80, 81, 81, 82, 82];

  const stats = {
    verificationsActive: 3,
    pending: 1,
    shared: 5,
    views: 18,
    avgValidation: "2.8 días",
  };

  const experiences = [
    { company: "Restaurante Central", role: "Camarero", dates: "2023 — 2025", status: "Verificado" },
    { company: "Hotel Sol", role: "Ayudante de sala", dates: "2022 — 2023", status: "En revisión" },
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
      {/* banda superior sutil estilo enterprise */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="h-72 bg-gradient-to-b from-blue-50/70 to-transparent" />
      </div>

      <div className="relative px-8 py-10">
        <div className="max-w-7xl mx-auto space-y-10">

          {/* Header (como company: claro, con CTAs) */}
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
                Descargar CV (próximo)
              </button>
            </div>
          </div>

          {/* HERO premium (ring + identidad + trend) */}
          <Card className="p-8 lg:p-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              <div className="lg:col-span-7">
                <TrustRingPro score={score} breakdown={breakdown} />
                <div className="mt-6 bg-gray-50 border border-gray-200 rounded-2xl p-5">
                  <CredibilitySparkline points={trend} />
                </div>
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

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="bg-white border border-gray-200 rounded-2xl p-4">
                      <div className="text-xs text-gray-500">Titular</div>
                      <div className="mt-1 text-sm font-semibold text-gray-900 line-clamp-2">
                        {title}
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-2xl p-4">
                      <div className="text-xs text-gray-500">Ubicación</div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">
                        {location}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <button className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition">
                      Editar perfil (próximo)
                    </button>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
                  <div className="text-sm font-semibold text-blue-900">Siguiente mejor acción</div>
                  <div className="mt-2 text-sm text-blue-700">
                    Completa una verificación más y añade 1 evidencia por experiencia para maximizar confianza.
                  </div>
                  <button className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition">
                    Empezar ahora
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* KPI strip (igual que company: cards compactas) */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
            <Stat label="Verificaciones activas" value={stats.verificationsActive} hint="En tu perfil" />
            <Stat label="Pendientes" value={stats.pending} hint="En revisión" />
            <Stat label="Compartidos" value={stats.shared} hint="Enlaces activos" />
            <Stat label="Visualizaciones" value={stats.views} hint="Últimos 30 días" />
            <Stat label="Tiempo medio" value={stats.avgValidation} hint="Histórico" />
          </div>

          {/* Experiencias: cards pro, no lista sin formato */}
          <div className="flex items-end justify-between gap-6">
            <div>
              <div className="text-xl font-semibold text-gray-900">Experiencia verificada</div>
              <div className="mt-1 text-sm text-gray-500">
                Presentación profesional para ti y para compartir con empresas.
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
          <Card className="p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="text-lg font-semibold text-gray-900">CV verificable (siguiente nivel)</div>
              <div className="mt-1 text-sm text-gray-500">
                En la siguiente mejora, generaremos un CV PDF “Verificado por Verijob” con tu foto y experiencias confirmadas.
              </div>
            </div>
            <button className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition">
              Activar CV (próximo)
            </button>
          </Card>

        </div>
      </div>
    </div>
  );
}
