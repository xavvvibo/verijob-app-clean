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

function clamp(n: number, a = 0, b = 100) {
  return Math.max(a, Math.min(b, n));
}

function scoreTone(score: number) {
  if (score >= 85) return { ring: "stroke-green-600", badge: "bg-green-50 text-green-700 border-green-100", label: "Profesional validado" };
  if (score >= 70) return { ring: "stroke-green-500", badge: "bg-green-50 text-green-700 border-green-100", label: "Alta confianza" };
  if (score >= 40) return { ring: "stroke-blue-600", badge: "bg-blue-50 text-blue-700 border-blue-100", label: "Verificado" };
  return { ring: "stroke-gray-400", badge: "bg-gray-50 text-gray-700 border-gray-200", label: "Inicial" };
}

function RingNoNumber({ score }: { score: number }) {
  const s = clamp(score);
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
          Credibilidad basada en verificaciones y evidencias reales.
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

function computeScore(verifications: VerificationRow[]) {
  const total = verifications.length;

  const verified = verifications.filter(v => (v.status || "").toLowerCase() === "approved").length;
  const confirmed = verifications.filter(v => !!v.company_confirmed).length;
  const evidences = verifications.reduce((acc, v) => acc + (v.evidence_count || 0), 0);

  const R = total > 0 ? verified / total : 0;
  const V = total > 0 ? confirmed / total : 0;
  const A = total > 0 ? Math.min(1, evidences / (total * 2)) : 0;

  // R/A/V ponderado (demo-ready y defendible)
  const score = Math.round((R * 0.5 + V * 0.3 + A * 0.2) * 100);

  // progreso perfil (mínimo, realista): nombre + actividad + verificación
  const profileCompletionBase = 0; // se suma luego con profile
  const completion = clamp(
    profileCompletionBase +
      (total > 0 ? 40 : 0) +
      (verified > 0 ? 30 : 0) +
      (evidences > 0 ? 20 : 0),
    0,
    100
  );

  return { total, verified, confirmed, evidences, score, completion };
}

export default function CandidateOverview() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  
  const [reuseEvents, setReuseEvents] = useState<number>(0);
  const [reuseCompanies, setReuseCompanies] = useState<number>(0);
const [rows, setRows] = useState<VerificationRow[]>([]);
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
          .select("full_name, location, avatar_url")
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

        // Reuse events (empresas que reutilizan tus verificaciones)
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
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Error cargando datos");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, []);

  const metrics = useMemo(() => {
    const m = computeScore(rows);
    const nameBonus = profile?.full_name ? 10 : 0;
    const reuseBonus = reuseCompanies >= 3 ? 20 : reuseCompanies >= 1 ? 10 : 0;
    const completion = clamp(m.completion + nameBonus);
    return { ...m, score: clamp(m.score + reuseBonus), completion };
  }, [rows, profile?.full_name]);

  const recent = useMemo(() => {
    // orden simple por start_date/end_date (si existe); si no, por company_name_freeform
    const copy = [...rows];
    copy.sort((a, b) => {
      const da = (a.end_date || a.start_date || "") as string;
      const db = (b.end_date || b.start_date || "") as string;
      return (db || "").localeCompare(da || "");
    });
    return copy.slice(0, 6);
  }, [rows]);

  const tone = scoreTone(metrics.score);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-3xl shadow-sm p-7 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="text-xs text-gray-500">Dashboard candidato</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900 truncate">
            {profile?.full_name ? profile.full_name : "Tu credibilidad profesional"}
          </div>
          <div className="mt-2 text-sm text-gray-600">
            Progreso perfil: <span className="font-semibold text-gray-900">{metrics.completion}%</span>
            {" · "}
            Score R/A/V: <span className="font-semibold text-gray-900">{metrics.score}%</span>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <PrimaryButton onClick={() => (window.location.href = "/candidate/verification/new")}>
              Crear verificación
            </PrimaryButton>
            <SecondaryButton onClick={() => (window.location.href = "/candidate/evidences")}>
              Subir evidencias
            </SecondaryButton>
            <SecondaryButton onClick={() => (window.location.href = "/candidate/share")}>
              Compartir perfil
            </SecondaryButton>
          </div>

          {err ? (
            <div className="mt-4 text-sm text-red-600">
              {err}
            </div>
          ) : null}

          {loading ? (
            <div className="mt-4 text-sm text-gray-500">
              Cargando datos…
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-end gap-4 shrink-0">
          <AvatarUploader
            currentUrl={profile?.avatar_url ?? ""}
            fallbackName={profile?.full_name ?? "Candidato"}
          />
          <div className={`inline-flex px-3 py-1 rounded-full border text-xs font-semibold ${tone.badge}`}>
            {tone.label}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card
          title="Credibilidad"
          subtitle="Basada en verificaciones reales"
          right={<span className="text-xs text-gray-500">R/A/V ponderado</span>}
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
            <Stat label="Confirmadas (empresa)" value={metrics.confirmed} />
            <Stat label="Evidencias" value={metrics.evidences} />
            <Stat label="Reutilizaciones" value={reuseEvents} />
            <Stat label="Empresas (reuse)" value={reuseCompanies} />
          </div>

          <Card
            title="Actividad reciente"
            subtitle="Tus últimas verificaciones"
          >
            {recent.length === 0 ? (
              <div className="text-sm text-gray-600">
                Aún no tienes verificaciones. Crea la primera y sube evidencias para aumentar tu credibilidad.
              </div>
            ) : (
              <div className="space-y-3">
                {recent.map((v) => (
                  <div key={v.verification_id} className="flex items-center justify-between gap-4 border border-gray-200 rounded-2xl p-4">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {(v.position || "Experiencia")} · {(v.company_name_freeform || "Empresa")}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        Evidencias: {v.evidence_count || 0} · Acciones: {v.actions_count || 0} · Reutilizaciones: {reuseEvents}
                        {v.is_revoked ? " · Revocada" : ""}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-3">
                      <StatusPill status={(v.status || "—")} />
                      <button
                        className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                        onClick={() => (window.location.href = `/candidate/verification/${v.verification_id}`)}
                      >
                        Ver
                      </button>
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
