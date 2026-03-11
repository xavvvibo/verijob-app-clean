"use client";

import { useEffect, useMemo, useState } from "react";
import { shouldShowCompanyNoActivityState } from "@/lib/company-dashboard-kpis";

type Kpis = {
  pending_requests: number;
  verified_30d: number;
  reuse_rate_pct: number;
  risk_signals: number;
  reuse_events_30d: number;
  reuse_events_total: number;
  completed_requests?: number;
  avg_resolution_hours?: number | null;
  verified_candidates?: number;
};

type DashboardPayload = {
  company_id?: string;
  company_name?: string;
  membership_role?: string;
  plan?: string;
  plan_label?: string;
  subscription_status?: string;
  company_verification_status?: "unverified" | "verified_document" | "verified_paid" | string;
  profile_completeness_score?: number;
  current_period_end?: string | null;
  kpis?: Kpis | null;
};

function verificationStatusLabel(statusRaw: unknown) {
  const status = String(statusRaw || "").toLowerCase();
  if (status === "verified_paid") return "Empresa verificada (plan activo)";
  if (status === "verified_document") return "Empresa verificada por documentación";
  return "Empresa no verificada";
}

function verificationStatusClass(statusRaw: unknown) {
  const status = String(statusRaw || "").toLowerCase();
  if (status === "verified_paid") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "verified_document") return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function formatDate(value?: string | null) {
  if (!value) return "No disponible";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "No disponible";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function isActiveSubscription(status?: string | null) {
  const s = String(status || "").toLowerCase();
  return s === "active" || s === "trialing";
}

function MetricCard({ title, value, helper }: { title: string; value: string; helper: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-semibold text-slate-900 tabular-nums">{value}</p>
      <p className="mt-2 text-sm text-slate-600">{helper}</p>
    </div>
  );
}

function ActionCard({
  title,
  subtitle,
  ctaLabel,
  ctaHref,
  secondaryLabel,
  secondaryHref,
}: {
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <a href={ctaHref} className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black transition">
          {ctaLabel}
        </a>
        {secondaryLabel && secondaryHref ? (
          <a href={secondaryHref} className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition">
            {secondaryLabel}
          </a>
        ) : null}
      </div>
    </article>
  );
}

export const dynamic = "force-dynamic";

export default function CompanyDashboard() {
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const response = await fetch("/api/company/dashboard", { cache: "no-store" as any });
        const body = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(body?.error ? `${body.error}${body?.details ? `: ${body.details}` : ""}` : "No se pudo cargar el panel.");
        }

        if (!alive) return;
        setPayload(body || {});
        setErrorMessage(null);
      } catch (e: any) {
        if (!alive) return;
        setErrorMessage(e?.message || "No se pudo cargar el panel de empresa.");
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const kpis = payload?.kpis || null;
  const companyName = payload?.company_name || "Tu empresa";
  const roleLabel = payload?.membership_role ? String(payload.membership_role).toUpperCase() : "REVIEWER";
  const planLabel = payload?.plan_label || "Free";
  const subscriptionStatus = payload?.subscription_status || "free";
  const verificationStatus = payload?.company_verification_status || "unverified";
  const profileCompleteness = Number(payload?.profile_completeness_score ?? 0);
  const activePlan = isActiveSubscription(subscriptionStatus);

  const planSummary = useMemo(() => {
    if (activePlan) {
      return `Plan ${planLabel} activo · Renovación: ${formatDate(payload?.current_period_end ?? null)}`;
    }
    return "Plan Free o sin suscripción activa · acceso básico habilitado";
  }, [activePlan, payload?.current_period_end, planLabel]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Command Center Empresa</p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">{companyName}</h1>
            <p className="mt-2 text-sm text-slate-600">
              Supervisa solicitudes, revisa candidatos verificables y acelera decisiones de contratación con trazabilidad.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Rol: {roleLabel}</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">{planSummary}</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Perfil {profileCompleteness}% completado</span>
              <span className={`rounded-full border px-3 py-1 font-semibold ${verificationStatusClass(verificationStatus)}`}>
                {verificationStatusLabel(verificationStatus)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {profileCompleteness < 100 ? (
                <a href="/company/profile" className="inline-flex rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100">
                  Completar perfil de empresa
                </a>
              ) : null}
              {String(verificationStatus).toLowerCase() === "unverified" ? (
                <a href="/company/profile" className="inline-flex rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100">
                  Verificar empresa
                </a>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <a href="/company/requests" className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black transition">
              Revisar solicitudes
            </a>
            <a href="/company/candidates" className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition">
              Abrir candidato
            </a>
            <a href="/company/billing" className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition">
              Ver suscripción
            </a>
          </div>
        </div>
        {errorMessage ? <p className="mt-4 text-sm text-red-600">{errorMessage}</p> : null}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Solicitudes pendientes"
          value={kpis ? String(kpis.pending_requests) : "—"}
          helper="Cola operativa de revisión"
        />
        <MetricCard
          title="Verificadas (30 días)"
          value={kpis ? String(kpis.verified_30d) : "—"}
          helper="Candidatos validados recientemente"
        />
        <MetricCard
          title="Reutilización"
          value={kpis ? `${kpis.reuse_rate_pct}%` : "—"}
          helper="Aprovechamiento de verificaciones existentes"
        />
        <MetricCard
          title="Señales de riesgo"
          value={kpis ? String(kpis.risk_signals) : "—"}
          helper="Incidencias que requieren seguimiento"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title="Solicitudes completadas"
          value={kpis ? String(Number(kpis.completed_requests || 0)) : "—"}
          helper="Verificadas, rechazadas o revocadas"
        />
        <MetricCard
          title="Tiempo medio resolución"
          value={kpis && kpis.avg_resolution_hours !== null && kpis.avg_resolution_hours !== undefined ? `${kpis.avg_resolution_hours}h` : "—"}
          helper="Desde solicitud hasta resolución"
        />
        <MetricCard
          title="Candidatos verificados"
          value={kpis ? String(Number(kpis.verified_candidates || 0)) : "—"}
          helper="Con al menos una verificación validada"
        />
      </section>

      {!activePlan ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-base font-semibold text-amber-900">Acceso limitado del plan actual</h2>
          <p className="mt-2 text-sm text-amber-900/90">
            Tu empresa puede operar en modo básico. Activa un plan superior para ampliar volumen de revisiones, equipo y trazabilidad avanzada.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href="/company/upgrade" className="inline-flex rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-800 transition">
              Mejorar plan
            </a>
            <a href="/company/billing" className="inline-flex rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-100 transition">
              Ver detalle de límites
            </a>
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <ActionCard
          title="Perfil de empresa"
          subtitle="Actualiza datos fiscales, operativos y de contratación para aumentar credibilidad y segmentación."
          ctaLabel="Editar perfil"
          ctaHref="/company/profile"
          secondaryLabel="Ajustes"
          secondaryHref="/company/settings"
        />
        <ActionCard
          title="Cola operativa"
          subtitle="Prioriza solicitudes pendientes y consulta el estado de cada verificación desde una única vista."
          ctaLabel="Ir a solicitudes"
          ctaHref="/company/requests"
          secondaryLabel="Ver equipo"
          secondaryHref="/company/team"
        />
        <ActionCard
          title="Reutilización"
          subtitle="Reutiliza verificaciones previas para reducir tiempos de validación en nuevos procesos."
          ctaLabel="Abrir reutilización"
          ctaHref="/company/reuse"
          secondaryLabel="Centro de ayuda"
          secondaryHref="/company/help"
        />
        <ActionCard
          title="Suscripción y límites"
          subtitle="Controla el plan activo, capacidad operativa y opciones de mejora para escalar evaluación."
          ctaLabel="Gestionar suscripción"
          ctaHref="/company/billing"
          secondaryLabel="Ver planes"
          secondaryHref="/company/upgrade"
        />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Actividad reciente</h2>
        {kpis ? (
          shouldShowCompanyNoActivityState(kpis) ? (
            <p className="mt-3 text-sm text-slate-600">
              Aún no hay actividad de verificación. Empieza revisando solicitudes o compartiendo token de candidato para iniciar validaciones.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>• Reutilizaciones en 30 días: <span className="font-medium text-slate-900">{kpis.reuse_events_30d}</span></li>
              <li>• Reutilizaciones acumuladas: <span className="font-medium text-slate-900">{kpis.reuse_events_total}</span></li>
              <li>• Solicitudes pendientes para hoy: <span className="font-medium text-slate-900">{kpis.pending_requests}</span></li>
            </ul>
          )
        ) : (
          <p className="mt-3 text-sm text-slate-600">
            Cuando empieces a recibir solicitudes y revisar candidatos, aquí verás el resumen de actividad de tu equipo.
          </p>
        )}
      </section>
    </div>
  );
}
