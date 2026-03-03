"use client";

import { useEffect, useMemo, useState } from "react";
import AvatarUploader from "@/components/profile/AvatarUploader";
import { createClient } from "@/utils/supabase/browser";

type ProfileLite = {
  full_name?: string | null;
  title?: string | null;
  location?: string | null;
  avatar_url?: string | null;
  email?: string | null;
  phone?: string | null;
};

function clsx(...x: Array<string | false | null | undefined>) {
  return x.filter(Boolean).join(" ");
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
    <div className={clsx("bg-white border border-gray-200 rounded-3xl shadow-sm", className)}>
      {(title || subtitle || right) ? (
        <div className="px-6 pt-6 flex items-start justify-between gap-4">
          <div>
            {title ? <div className="text-sm font-semibold text-gray-900">{title}</div> : null}
            {subtitle ? <div className="mt-1 text-sm text-gray-500">{subtitle}</div> : null}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      ) : null}
      <div className={clsx((title || subtitle || right) ? "px-6 pb-6 pt-4" : "p-6", "text-gray-900")}>
        {children}
      </div>
    </div>
  );
}

function scoreTone(score: number) {
  if (score >= 85) return { ring: "stroke-green-600", badge: "bg-green-50 text-green-700 border-green-100", label: "Profesional validado" };
  if (score >= 70) return { ring: "stroke-green-500", badge: "bg-green-50 text-green-700 border-green-100", label: "Alta confianza" };
  if (score >= 40) return { ring: "stroke-blue-600", badge: "bg-blue-50 text-blue-700 border-blue-100", label: "Verificado" };
  return { ring: "stroke-gray-400", badge: "bg-gray-50 text-gray-700 border-gray-200", label: "Inicial" };
}

function AvatarRing({
  score,
  size = 124,
  stroke = 10,
}: {
  score: number;
  size?: number;
  stroke?: number;
}) {
  const s = Math.max(0, Math.min(100, score));
  const r = (size / 2) - stroke * 0.5;
  const c = 2 * Math.PI * r;
  const offset = c - (s / 100) * c;

  const tone = scoreTone(s);

  return (
    <svg width={size} height={size} className="absolute -inset-1 rotate-[-90deg]">
      <circle cx={size/2} cy={size/2} r={r} stroke="#e5e7eb" strokeWidth={stroke} fill="transparent" />
      <circle
        cx={size/2}
        cy={size/2}
        r={r}
        strokeWidth={stroke}
        fill="transparent"
        strokeLinecap="round"
        className={clsx(tone.ring, "transition-all duration-700")}
        strokeDasharray={c}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

function SkillBar({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="tabular-nums">{v}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-fuchsia-500"
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}

function StatMini({ value, label }: { value: any; label: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="text-xl font-semibold text-gray-900 tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-gray-500">{label}</div>
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

  return <span className={clsx("inline-flex px-3 py-1 rounded-full border text-xs font-semibold", cls)}>{status}</span>;
}

export default function CandidateOverview() {
  // PERFIL REAL
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

  // DATOS (ahora mock con formato pro; siguiente paso: conectar a verification_summary real)
  const score = 82;
  const tone = scoreTone(score);

  const about = "Profesional de hostelería orientado a servicio y equipo. Experiencia en sala y operaciones. Busco entornos donde el trabajo bien hecho se note.";

  const experiences = [
    { company: "Restaurante Central", role: "Camarero", dates: "2023 — 2025", status: "Verificado", note: "Turnos intensivos · servicio a mesa · gestión de incidencias" },
    { company: "Hotel Sol", role: "Ayudante de sala", dates: "2022 — 2023", status: "En revisión", note: "Eventos · apoyo a jefatura · coordinación con cocina" },
    { company: "Cafetería Plaza", role: "Barista", dates: "2020 — 2022", status: "Verificado", note: "Café de especialidad · caja · control de stock" },
  ];

  const education = [
    { dates: "2018 — 2020", name: "Formación / Curso", place: "Centro / Escuela", note: "Atención al cliente · seguridad alimentaria" },
    { dates: "2016 — 2018", name: "Formación / Curso", place: "Centro / Escuela", note: "Operativa de sala · control de tiempos" },
  ];

  const skills = [
    { label: "Servicio en sala", value: 88 },
    { label: "Trabajo en equipo", value: 84 },
    { label: "Atención al cliente", value: 90 },
    { label: "Gestión de caja", value: 72 },
    { label: "Eventos / banquetes", value: 66 },
    { label: "Inglés operativo", value: 60 },
  ];

  const metrics = {
    verificationsActive: 3,
    pending: 1,
    profileViews30d: 18,
    shares30d: 5,
    avgValidation: "2.8 días",
    completion: "92%",
  };

  const activity = [
    { when: "Hoy", what: "Tu perfil fue consultado por una empresa" },
    { when: "Ayer", what: "Evidencia añadida a Hotel Sol" },
    { when: "Hace 3 días", what: "Restaurante Central confirmó tu experiencia" },
  ];

  const name = profile.full_name ?? "Candidato";
  const title = profile.title ?? "Profesional";
  const location = profile.location ?? "España";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="absolute inset-0 pointer-events-none">
        <div className="h-64 bg-gradient-to-b from-blue-50/70 to-transparent" />
      </div>

      <div className="relative px-8 py-10">
        <div className="max-w-7xl mx-auto">

          {/* GRID estilo “resume dashboard” */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

            {/* LEFT SIDEBAR */}
            <div className="xl:col-span-3 space-y-6">
              <Card className="p-0 overflow-hidden">
                <div className="p-6 bg-gradient-to-b from-white to-gray-50">
                  <div className="flex flex-col items-center text-center">
                    <div className="relative">
                      <div className="w-[124px] h-[124px] rounded-full overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center">
                        {profile.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={profile.avatar_url} alt="Foto de perfil" className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-gray-500 text-2xl font-semibold">VP</div>
                        )}
                      </div>
                      <AvatarRing score={score} />
                    </div>

                    <div className="mt-5 text-lg font-semibold text-gray-900">
                      {loadingProfile ? "Cargando…" : name}
                    </div>
                    <div className="mt-1 text-sm text-gray-600">{title}</div>
                    <div className="mt-1 text-xs text-gray-500">{location}</div>

                    <div className={clsx("mt-4 inline-flex px-3 py-1 rounded-full border text-xs font-semibold", tone.badge)}>
                      {tone.label}
                    </div>

                    <div className="mt-5 w-full">
                      <AvatarUploader
                        currentUrl={profile.avatar_url ?? null}
                        fallbackName={name}
                        onUpdated={(url) => setProfile((p) => ({ ...p, avatar_url: url }))}
                      />
                    </div>

                    <div className="mt-6 w-full grid grid-cols-2 gap-3">
                      <button className="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition">
                        Compartir
                      </button>
                      <button className="px-3 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition">
                        CV (próximo)
                      </button>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-5 border-t border-gray-200">
                  <div className="text-xs font-semibold text-gray-900">Contacto</div>
                  <div className="mt-3 space-y-2 text-sm text-gray-600">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-gray-500">Email</span>
                      <span className="truncate">{profile.email ?? "—"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-gray-500">Tel.</span>
                      <span className="truncate">{profile.phone ?? "—"}</span>
                    </div>
                  </div>
                </div>
              </Card>

              <Card title="Acciones rápidas" subtitle="Mejora tu perfil en 2 minutos">
                <div className="space-y-3">
                  <button className="w-full px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition">
                    Añadir verificación
                  </button>
                  <button className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition">
                    Añadir evidencia
                  </button>
                  <button className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition">
                    Editar descripción (próximo)
                  </button>
                </div>
              </Card>
            </div>

            {/* CENTER */}
            <div className="xl:col-span-6 space-y-6">
              <Card
                title="Descripción"
                subtitle="Cómo te presentas ante una empresa"
                right={<span className="text-xs text-gray-500">Se usará en tu CV verificado</span>}
              >
                <div className="text-sm text-gray-700 leading-relaxed">
                  {about}
                </div>
              </Card>

              <Card title="Experiencia" subtitle="Historial profesional verificable">
                <div className="space-y-4">
                  {experiences.map((e, i) => (
                    <div key={i} className="border border-gray-200 rounded-2xl p-5 bg-gray-50/40">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{e.company}</div>
                          <div className="mt-1 text-sm text-gray-700">{e.role}</div>
                          <div className="mt-1 text-xs text-gray-500">{e.dates}</div>
                        </div>
                        <StatusPill status={e.status} />
                      </div>
                      <div className="mt-3 text-sm text-gray-600">{e.note}</div>

                      <div className="mt-4 flex flex-wrap gap-3">
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
              </Card>

              <Card title="Formación" subtitle="Educación y cursos relevantes">
                <div className="space-y-4">
                  {education.map((ed, i) => (
                    <div key={i} className="border border-gray-200 rounded-2xl p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{ed.name}</div>
                          <div className="mt-1 text-sm text-gray-700">{ed.place}</div>
                          <div className="mt-2 text-sm text-gray-600">{ed.note}</div>
                        </div>
                        <div className="text-xs text-gray-500 tabular-nums">{ed.dates}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* RIGHT */}
            <div className="xl:col-span-3 space-y-6">
              <Card title="Skills" subtitle="Señales rápidas para recruiters">
                <div className="space-y-4">
                  {skills.map((s, i) => (
                    <SkillBar key={i} label={s.label} value={s.value} />
                  ))}
                </div>
              </Card>

              <Card title="Métricas" subtitle="Actividad y rendimiento">
                <div className="grid grid-cols-2 gap-4">
                  <StatMini value={metrics.verificationsActive} label="Verificaciones activas" />
                  <StatMini value={metrics.pending} label="Pendientes" />
                  <StatMini value={metrics.profileViews30d} label="Vistas (30d)" />
                  <StatMini value={metrics.shares30d} label="Shares (30d)" />
                </div>

                <div className="mt-5 border border-gray-200 rounded-2xl p-4 bg-gray-50/40">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">Tiempo medio validación</div>
                    <div className="text-sm font-semibold text-gray-900 tabular-nums">{metrics.avgValidation}</div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-xs text-gray-500">Completitud perfil</div>
                    <div className="text-sm font-semibold text-gray-900 tabular-nums">{metrics.completion}</div>
                  </div>
                </div>
              </Card>

              <Card title="Histórico" subtitle="Eventos recientes">
                <div className="space-y-3">
                  {activity.map((a, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="mt-1.5 inline-block w-2.5 h-2.5 rounded-full bg-blue-600" />
                      <div>
                        <div className="text-xs text-gray-500">{a.when}</div>
                        <div className="text-sm text-gray-700">{a.what}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <button className="mt-5 w-full px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition">
                  Ver historial completo
                </button>
              </Card>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
