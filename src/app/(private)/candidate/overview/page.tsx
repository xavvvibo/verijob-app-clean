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

      <div className="absolute text-center px-8">
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
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-gray-900 tabular-nums">{value}</div>
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

function PrimaryButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition">
      {children}
    </button>
  );
}

function SecondaryButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition">
      {children}
    </button>
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

    return () => { cancelled = true; };
  }, []);

  // Mock pro (siguiente paso: conectar a verification_summary real)
  const score = 82;
  const metrics = { active: 3, pending: 1, views30d: 18, shares30d: 5, avgValidation: "2.8 días" };

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
    if (score >= 70) return "Buen nivel. Completa 1 verificación más para subir al máximo.";
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

          {/* HEADER (limpio, como company) */}
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
              <PrimaryButton>Añadir verificación</PrimaryButton>
              <SecondaryButton>Compartir perfil</SecondaryButton>
              <SecondaryButton>CV verificado (próximo)</SecondaryButton>
            </div>
          </div>

          {/* HERO centrado (identidad + scoring + CTA) */}
          <Card className="overflow-hidden">
            <div className="p-8 lg:p-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">

                <div className="lg:col-span-5 flex flex-col items-center lg:items-start">
                  <RingNoNumber score={score} />
                </div>

                <div className="lg:col-span-7 space-y-6">
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                    <div className="text-sm font-semibold text-gray-900">Identidad</div>
                    <div className="mt-4">
                      <AvatarUploader
                        currentUrl={profile.avatar_url ?? null}
                        fallbackName={name}
                        onUpdated={(url) => setProfile((p) => ({ ...p, avatar_url: url }))}
                      />
                    </div>
                    <div className="mt-4 text-sm text-gray-600">
                      Tip: una foto profesional + titular claro aumenta la confianza y prepara el CV verificado.
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
                      <div className="text-sm font-semibold text-blue-900">Siguiente mejor acción</div>
                      <div className="mt-2 text-sm text-blue-700">
                        Añade una experiencia reciente y 1 evidencia. Es lo que más mejora tu score.
                      </div>
                      <div className="mt-4">
                        <PrimaryButton>Empezar</PrimaryButton>
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                      <div className="text-sm font-semibold text-gray-900">Checklist</div>
                      <ul className="mt-3 text-sm text-gray-600 space-y-2">
                        <li>• Foto profesional</li>
                        <li>• 1 verificación nueva</li>
                        <li>• 1 evidencia por experiencia</li>
                        <li>• Compartir enlace a empresa</li>
                      </ul>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </Card>

          {/* KPI STRIP (compacto, organizado) */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
            <Stat label="Activas" value={metrics.active} />
            <Stat label="Pendientes" value={metrics.pending} />
            <Stat label="Vistas (30d)" value={metrics.views30d} />
            <Stat label="Shares (30d)" value={metrics.shares30d} />
            <Stat label="T. medio" value={metrics.avgValidation} />
          </div>

          {/* EXPERIENCIA (bloque principal, con aire) */}
          <div className="flex items-end justify-between gap-6">
            <div>
              <div className="text-xl font-semibold text-gray-900">Experiencia verificable</div>
              <div className="mt-1 text-sm text-gray-500">
                Ordenado y claro. Ideal para compartir con empresas.
              </div>
            </div>
            <SecondaryButton>Ver todas</SecondaryButton>
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
                  <PrimaryButton>Ver detalle</PrimaryButton>
                  <SecondaryButton>Añadir evidencia</SecondaryButton>
                </div>
              </div>
            ))}
          </div>

          {/* ACCIONES ESTRATÉGICAS (ordenadas, sin competir con el hero) */}
          <Card title="Acciones" subtitle="Lo que más impacta tu credibilidad">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                <div className="text-sm font-semibold text-gray-900">Añadir verificación</div>
                <div className="mt-2 text-sm text-gray-600">Nueva experiencia o empleo reciente.</div>
                <div className="mt-4"><PrimaryButton>Crear</PrimaryButton></div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                <div className="text-sm font-semibold text-gray-900">Compartir perfil</div>
                <div className="mt-2 text-sm text-gray-600">Enlace seguro para empresas.</div>
                <div className="mt-4"><SecondaryButton>Compartir</SecondaryButton></div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                <div className="text-sm font-semibold text-gray-900">CV verificado</div>
                <div className="mt-2 text-sm text-gray-600">PDF con foto + verificación.</div>
                <div className="mt-4"><SecondaryButton>Activar (próximo)</SecondaryButton></div>
              </div>
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}
