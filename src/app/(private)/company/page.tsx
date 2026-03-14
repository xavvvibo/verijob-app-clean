"use client";

import { useEffect, useMemo, useState } from "react";
import { resolveCompanyDisplayName } from "@/lib/company/company-profile";

type Kpis = {
  pending_requests: number;
  verified_30d: number;
  risk_signals: number;
  completed_requests?: number;
  avg_resolution_hours?: number | null;
  verified_candidates?: number;
};

type RecentRequest = {
  id: string;
  candidate_name: string;
  status: "pending" | "verified" | "rejected" | "other";
  requested_at?: string | null;
  position?: string | null;
  company_name?: string | null;
};

type DashboardPayload = {
  company_name?: string;
  plan_label?: string;
  subscription_status?: string;
  company_verification_status?: string;
  profile_completeness_score?: number;
  kpis?: Kpis | null;
  verification_activity?: {
    pending?: number;
    verified?: number;
    rejected?: number;
  } | null;
  recent_requests?: RecentRequest[] | null;
};

type ProfileCompletionItem = {
  id: string;
  title: string;
  status: "completed" | "pending" | "recommended" | "optional";
  priority: "required" | "recommended" | "optional";
};

type ProfilePayload = {
  profile?: Record<string, any> | null;
  profile_completion?: {
    score?: number | null;
    required?: { completed?: number; total?: number } | null;
    recommended?: { completed?: number; total?: number } | null;
    checklist?: ProfileCompletionItem[] | null;
  } | null;
};

type TeamPayload = {
  plan?: {
    label?: string;
    seats_limit?: number;
    seats_used?: number;
    pending_invitations?: number;
  } | null;
};

type CandidateImportRow = {
  id: string;
  candidate_name_raw?: string | null;
  linked_profile_name?: string | null;
  candidate_email?: string | null;
  target_role?: string | null;
  display_status?: string | null;
  candidate_public_token?: string | null;
  company_stage?: "none" | "saved" | "preselected" | string | null;
  created_at?: string | null;
  last_activity_at?: string | null;
  total_verifications?: number | null;
  approved_verifications?: number | null;
  access_status?: "active" | "expired" | "never" | string | null;
  access_expires_at?: string | null;
};

type CandidatesPayload = {
  imports?: CandidateImportRow[] | null;
  imports_meta?: { available?: boolean } | null;
};

type PriorityItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  cta: string;
  tone: string;
  priority: number;
  meta: string;
};

type NotificationItem = {
  id: string;
  tone: string;
  title: string;
  detail: string;
  href: string;
  cta: string;
  timestamp: string | null;
  type: "onboarding" | "experiences" | "verification" | "evidences";
};

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function verificationStatusLabel(statusRaw: unknown) {
  const status = String(statusRaw || "").toLowerCase();
  if (status === "verified_paid") return "Empresa verificada por plan";
  if (status === "verified_document") return "Empresa verificada por documentación";
  return "Empresa pendiente de verificación";
}

function verificationStatusClass(statusRaw: unknown) {
  const status = String(statusRaw || "").toLowerCase();
  if (status === "verified_paid") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "verified_document") return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function checklistDot(status: ProfileCompletionItem["status"]) {
  if (status === "completed") return "bg-emerald-500";
  if (status === "recommended") return "bg-blue-500";
  if (status === "optional") return "bg-slate-400";
  return "bg-amber-500";
}

function importBadge(raw: string | null | undefined) {
  const value = String(raw || "").toLowerCase();
  if (value === "verified") return { label: "Listo para decisión", tone: "border-emerald-200 bg-emerald-50 text-emerald-800" };
  if (value === "profile_created" || value === "existing_candidate") return { label: "Listo para revisar", tone: "border-indigo-200 bg-indigo-50 text-indigo-700" };
  if (value === "verifying") return { label: "En validación", tone: "border-blue-200 bg-blue-50 text-blue-700" };
  if (value === "acceptance_pending") return { label: "Pendiente de aceptación", tone: "border-amber-200 bg-amber-50 text-amber-800" };
  return { label: "Importado", tone: "border-slate-200 bg-slate-100 text-slate-700" };
}

function ProgressBar({ value, tone }: { value: number; tone: string }) {
  return (
    <div className="h-2 rounded-full bg-slate-200">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function MetricCard({ title, value, helper }: { title: string; value: string; helper: string }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900 tabular-nums">{value}</p>
      <p className="mt-2 text-sm text-slate-600">{helper}</p>
    </article>
  );
}

export const dynamic = "force-dynamic";

export default function CompanyDashboard() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [profileData, setProfileData] = useState<ProfilePayload | null>(null);
  const [teamData, setTeamData] = useState<TeamPayload | null>(null);
  const [candidateData, setCandidateData] = useState<CandidatesPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("vj_company_candidate_notifications_read");
      const parsed = raw ? JSON.parse(raw) : [];
      setReadNotificationIds(Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : []);
    } catch {
      setReadNotificationIds([]);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [dashboardRes, profileRes, teamRes, candidateRes] = await Promise.all([
          fetch("/api/company/dashboard", { cache: "no-store" as any }),
          fetch("/api/company/profile", { cache: "no-store" as any }),
          fetch("/api/company/team", { cache: "no-store" as any }),
          fetch("/api/company/candidate-imports", { cache: "no-store" as any }),
        ]);
        const [dashboardBody, profileBody, teamBody, candidateBody] = await Promise.all([
          dashboardRes.json().catch(() => ({})),
          profileRes.json().catch(() => ({})),
          teamRes.json().catch(() => ({})),
          candidateRes.json().catch(() => ({})),
        ]);

        if (!dashboardRes.ok) {
          if (dashboardRes.status === 423) {
            if (!alive) return;
            setDashboard(dashboardBody || {});
            setProfileData(profileRes.ok ? profileBody || {} : null);
            setTeamData(teamRes.ok ? teamBody || {} : null);
            setCandidateData(candidateRes.ok ? candidateBody || {} : null);
            setErrorMessage(
              dashboardBody?.user_message || "La empresa está desactivada o cerrada. Reactívala desde ajustes para retomar la operación."
            );
            return;
          }
          throw new Error("No se pudo cargar el panel de empresa.");
        }
        if (!alive) return;
        setDashboard(dashboardBody || {});
        setProfileData(profileRes.ok ? profileBody || {} : null);
        setTeamData(teamRes.ok ? teamBody || {} : null);
        setCandidateData(candidateRes.ok ? candidateBody || {} : null);
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

  const companyName = resolveCompanyDisplayName(
    {
      trade_name: profileData?.profile?.trade_name,
      legal_name: profileData?.profile?.legal_name,
      display_name: profileData?.profile?.display_name,
      name: dashboard?.company_name,
    },
    "Tu empresa"
  );
  const planLabel = dashboard?.plan_label || teamData?.plan?.label || "Free";
  const verificationStatus = dashboard?.company_verification_status || "unverified";
  const profileCompletion = Number(profileData?.profile_completion?.score ?? dashboard?.profile_completeness_score ?? 0);
  const checklist = Array.isArray(profileData?.profile_completion?.checklist)
    ? profileData?.profile_completion?.checklist?.slice(0, 4)
    : [];
  const kpis = dashboard?.kpis || null;
  const recentRequests = Array.isArray(dashboard?.recent_requests) ? dashboard.recent_requests : [];
  const imports = Array.isArray(candidateData?.imports) ? candidateData.imports : [];
  const importsAvailable = candidateData?.imports_meta?.available !== false;
  const verificationActivity = dashboard?.verification_activity || { pending: 0, verified: 0, rejected: 0 };
  const verificationTotal = Math.max(1, Number(verificationActivity.pending || 0) + Number(verificationActivity.verified || 0) + Number(verificationActivity.rejected || 0));
  const seatsLimit = Number(teamData?.plan?.seats_limit || 0);
  const seatsUsed = Number(teamData?.plan?.seats_used || 0);
  const pendingInvitations = Number(teamData?.plan?.pending_invitations || 0);
  const seatUsagePct = seatsLimit > 0 ? Math.round(((seatsUsed + pendingInvitations) / seatsLimit) * 100) : 0;

  const pipeline = useMemo(() => {
    const byReview = Number(kpis?.pending_requests || 0) + imports.filter((item) => item.display_status === "acceptance_pending" || item.display_status === "processing").length;
    const validating = imports.filter((item) => item.display_status === "verifying" || item.display_status === "profile_created").length;
    const ready = imports.filter((item) => item.display_status === "existing_candidate" || item.display_status === "verified").length;
    return { byReview, validating, ready };
  }, [imports, kpis?.pending_requests]);

  const priorities = useMemo<PriorityItem[]>(() => {
    const items: PriorityItem[] = [];

    recentRequests
      .filter((item) => item.status === "pending")
      .slice(0, 4)
      .forEach((item, index) => {
        items.push({
          id: `req-${item.id}`,
          title: item.candidate_name || "Solicitud pendiente",
          detail: `${item.position || "Experiencia sin puesto"} · ${item.company_name || "Empresa"}`,
          href: `/company/verification/${item.id}`,
          cta: "Resolver ahora",
          tone: "border-amber-200 bg-amber-50 text-amber-900",
          priority: 100 - index,
          meta: `Pendiente desde ${formatDate(item.requested_at)}`,
        });
      });

    imports
      .filter((item) => item.display_status === "acceptance_pending" || item.display_status === "existing_candidate" || item.display_status === "profile_created")
      .slice(0, 4)
      .forEach((item, index) => {
        items.push({
          id: `imp-${item.id}`,
          title: item.linked_profile_name || item.candidate_name_raw || item.candidate_email || "Candidato importado",
          detail:
            item.display_status === "acceptance_pending"
              ? "CV importado pendiente de aceptación del candidato."
              : item.display_status === "existing_candidate"
                ? "El candidato ya existe en VERIJOB y puede revisarse desde perfil."
                : "Perfil creado y listo para revisión interna.",
          href: item.candidate_public_token ? `/company/candidate/${item.candidate_public_token}` : "/company/candidates",
          cta: item.candidate_public_token ? "Abrir perfil" : "Abrir base RRHH",
          tone:
            item.display_status === "acceptance_pending"
              ? "border-blue-200 bg-blue-50 text-blue-900"
              : "border-violet-200 bg-violet-50 text-violet-900",
          priority: 80 - index,
          meta: `Última actividad ${formatDate(item.last_activity_at || item.created_at)}`,
        });
      });

    const expiredAccessCount = imports.filter((item) => item.access_status === "expired").length;
    if (expiredAccessCount > 0) {
      items.push({
        id: "expired-access",
        title: "Accesos a renovar",
        detail: "Algunos candidatos de tu base RRHH ya no tienen acceso activo al perfil completo.",
        href: "/company/candidates",
        cta: "Revisar accesos",
        tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
        priority: 50,
        meta: `${expiredAccessCount} accesos expirados en tu base`,
      });
    }

    return items.sort((a, b) => b.priority - a.priority).slice(0, 6);
  }, [imports, recentRequests]);

  const rrhhRows = useMemo(() => {
    return imports
      .slice()
      .sort((a, b) => Date.parse(String(b.last_activity_at || b.created_at || 0)) - Date.parse(String(a.last_activity_at || a.created_at || 0)))
      .slice(0, 5);
  }, [imports]);

  const notifications = useMemo<NotificationItem[]>(() => {
    return imports
      .filter((item) => item.company_stage === "saved" || item.company_stage === "preselected")
      .flatMap((item) => {
        const label = item.linked_profile_name || item.candidate_name_raw || item.candidate_email || "Candidato";
        const href = item.candidate_public_token ? `/company/candidate/${item.candidate_public_token}` : "/company/candidates";
        const rows: NotificationItem[] = [];
        if (item.display_status === "profile_created") {
          rows.push({
            id: `${item.id}-onboarding`,
            tone: "border-indigo-200 bg-indigo-50 text-indigo-900",
            title: `${label} ha terminado el onboarding inicial`,
            detail: "El perfil ya está disponible para revisar en snapshot antes de consumir una visualización completa.",
            href,
            cta: "Revisar candidato",
            timestamp: item.last_activity_at || item.created_at || null,
            type: "onboarding",
          });
        }
        if (item.display_status === "profile_created") {
          rows.push({
            id: `${item.id}-experiences`,
            tone: "border-slate-200 bg-slate-50 text-slate-900",
            title: `${label} ya tiene experiencias cargadas`,
            detail: "Puedes revisar la nueva versión del perfil y decidir si merece abrir el perfil completo.",
            href,
            cta: "Ver snapshot",
            timestamp: item.last_activity_at || item.created_at || null,
            type: "experiences",
          });
        }
        if (item.display_status === "verifying") {
          rows.push({
            id: `${item.id}-verifying`,
            tone: "border-blue-200 bg-blue-50 text-blue-900",
            title: `${label} está avanzando en verificaciones`,
            detail: "Ya hay actividad de validación sobre el perfil y conviene revisar su progreso.",
            href,
            cta: "Ver progreso",
            timestamp: item.last_activity_at || item.created_at || null,
            type: "verification",
          });
        }
        if (Number(item.total_verifications || 0) > 0 && Number(item.total_verifications || 0) === Number(item.approved_verifications || 0)) {
          rows.push({
            id: `${item.id}-verified`,
            tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
            title: `${label} ya tiene verificaciones aprobadas`,
            detail: `${Number(item.approved_verifications || 0)} validaciones aprobadas disponibles para decisión.`,
            href,
            cta: "Abrir perfil",
            timestamp: item.last_activity_at || item.created_at || null,
            type: "verification",
          });
        }
        if (item.display_status === "verifying" || (Number(item.total_verifications || 0) > 0 && Number(item.approved_verifications || 0) === 0)) {
          rows.push({
            id: `${item.id}-evidences`,
            tone: "border-amber-200 bg-amber-50 text-amber-900",
            title: `${label} ha subido evidencias o documentación`,
            detail: "El perfil ya tiene material adicional para apoyar la validación.",
            href,
            cta: "Revisar snapshot",
            timestamp: item.last_activity_at || item.created_at || null,
            type: "evidences",
          });
        }
        return rows;
      })
      .sort((a, b) => Date.parse(String(b.timestamp || 0)) - Date.parse(String(a.timestamp || 0)))
      .slice(0, 8);
  }, [imports]);

  const visibleNotifications = useMemo(
    () => notifications.filter((item) => !readNotificationIds.includes(item.id)).slice(0, 4),
    [notifications, readNotificationIds]
  );

  function markNotificationRead(id: string) {
    setReadNotificationIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id].slice(-50);
      try {
        window.localStorage.setItem("vj_company_candidate_notifications_read", JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Panel de control</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{companyName}</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Vista operativa para priorizar el trabajo de hoy, mover candidatos y tener claro qué limita o desbloquea tu operación.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">Plan {planLabel}</span>
              <span className={`rounded-full border px-3 py-1 font-semibold ${verificationStatusClass(verificationStatus)}`}>{verificationStatusLabel(verificationStatus)}</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">Perfil {profileCompletion}% listo</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/company/requests" className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black transition">Revisar solicitudes</a>
            <a href="/company/candidates" className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition">Abrir base RRHH</a>
            <a href="/company/subscription" className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition">Plan y capacidad</a>
          </div>
        </div>
        {errorMessage ? <p className="mt-4 text-sm text-rose-600">{errorMessage}</p> : null}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Pendientes hoy" value={kpis ? String(kpis.pending_requests) : "—"} helper="Solicitudes listas para resolver." />
        <MetricCard title="Confirmadas 30 días" value={kpis ? String(kpis.verified_30d) : "—"} helper="Experiencias confirmadas recientemente." />
        <MetricCard title="Tiempo medio" value={kpis?.avg_resolution_hours != null ? `${kpis.avg_resolution_hours} h` : "—"} helper="Desde petición hasta resolución." />
        <MetricCard title="Perfiles útiles" value={kpis ? String(Number(kpis.verified_candidates || 0)) : "—"} helper="Candidatos con historial ya validado." />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Hoy / prioridades</h2>
              <p className="mt-1 text-sm text-slate-600">Lo más accionable ahora mismo: solicitudes, candidatos importados y accesos a perfiles.</p>
            </div>
            <a href="/company/requests" className="text-sm font-semibold text-slate-900 underline underline-offset-2">Abrir inbox</a>
          </div>

          <div className="mt-4 space-y-3">
            {priorities.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                No hay pendientes críticos ahora. Buen momento para completar perfil, ampliar equipo o cargar nuevos candidatos.
              </div>
            ) : (
              priorities.map((item) => (
                <article key={item.id} className={`rounded-2xl border p-4 ${item.tone}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="mt-1 text-sm opacity-90">{item.detail}</p>
                      <p className="mt-2 text-xs opacity-75">{item.meta}</p>
                    </div>
                    <a href={item.href} className="inline-flex rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100">
                      {item.cta}
                    </a>
                  </div>
                </article>
              ))
            )}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Estado del perfil empresa</h2>
              <p className="mt-1 text-sm text-slate-600">Checklist corta para que tu operación tenga más contexto y credibilidad.</p>
            </div>
            <a href="/company/profile" className="text-sm font-semibold text-slate-900 underline underline-offset-2">Editar perfil</a>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{profileCompletion}% completado</p>
                <p className="mt-1 text-xs text-slate-600">
                  Obligatorio {Number(profileData?.profile_completion?.required?.completed || 0)}/{Number(profileData?.profile_completion?.required?.total || 0)} ·
                  Recomendado {Number(profileData?.profile_completion?.recommended?.completed || 0)}/{Number(profileData?.profile_completion?.recommended?.total || 0)}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <ProgressBar value={profileCompletion} tone="bg-slate-900" />
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {checklist.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <span className={`h-2.5 w-2.5 rounded-full ${checklistDot(item.status)}`} />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {item.priority === "required" ? "Obligatorio" : item.priority === "recommended" ? "Recomendado" : "Opcional"}
                </p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Pipeline RRHH ligero</h2>
              <p className="mt-1 text-sm text-slate-600">Vista mínima de trabajo sin convertir VERIJOB en un ATS nuevo.</p>
            </div>
            <a href="/company/candidates" className="text-sm font-semibold text-slate-900 underline underline-offset-2">Abrir candidatos</a>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs uppercase tracking-wide text-amber-800">Por revisar</p>
              <p className="mt-2 text-3xl font-semibold text-amber-900">{pipeline.byReview}</p>
              <p className="mt-1 text-sm text-amber-900/80">Solicitudes pendientes e importaciones esperando siguiente paso.</p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs uppercase tracking-wide text-blue-800">En validación</p>
              <p className="mt-2 text-3xl font-semibold text-blue-900">{pipeline.validating}</p>
              <p className="mt-1 text-sm text-blue-900/80">Perfiles ya moviéndose en revisión o validación documental.</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs uppercase tracking-wide text-emerald-800">Listos para decisión</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-900">{pipeline.ready}</p>
              <p className="mt-1 text-sm text-emerald-900/80">Perfiles que ya merece la pena abrir y decidir.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              { label: "Pendientes", value: Number(verificationActivity.pending || 0), tone: "bg-amber-500" },
              { label: "Confirmadas", value: Number(verificationActivity.verified || 0), tone: "bg-emerald-500" },
              { label: "Rechazadas", value: Number(verificationActivity.rejected || 0), tone: "bg-rose-500" },
            ].map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-900">{item.label}</span>
                  <span className="text-slate-500">{item.value}</span>
                </div>
                <ProgressBar value={(item.value / verificationTotal) * 100} tone={item.tone} />
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Plan y capacidad</h2>
              <p className="mt-1 text-sm text-slate-600">Qué tienes ahora, qué te limita hoy y cuál es el siguiente salto útil.</p>
            </div>
            <a href="/company/subscription" className="text-sm font-semibold text-slate-900 underline underline-offset-2">Gestionar plan</a>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{seatsUsed + pendingInvitations}/{seatsLimit || 1} plazas en uso</p>
                <p className="mt-1 text-xs text-slate-600">{seatsUsed} activas · {pendingInvitations} invitaciones pendientes</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">Plan {planLabel}</span>
            </div>
            <div className="mt-3">
              <ProgressBar value={seatUsagePct} tone={seatUsagePct >= 85 ? "bg-amber-500" : "bg-blue-600"} />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">Qué te está limitando hoy</p>
              <p className="mt-1 text-sm text-slate-600">
                {seatsLimit <= 1
                  ? "La colaboración de equipo es mínima y conviene ampliar plazas."
                  : seatUsagePct >= 85
                    ? "Estás cerca del límite de plazas y pronto vas a necesitar más capacidad."
                    : "Tu plan actual cubre la operación de hoy con margen razonable."}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <p className="text-sm font-semibold">Qué desbloquea el upgrade</p>
              <p className="mt-1 text-sm">
                Más capacidad de equipo, más ritmo operativo y un panel empresa que puede crecer contigo sin fricciones.
              </p>
              <a href="/company/upgrade" className="mt-3 inline-flex rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800">
                Ver y contratar planes
              </a>
            </div>
          </div>
        </article>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Notificaciones de candidatos guardados</h2>
            <p className="mt-1 text-sm text-slate-600">Alertas internas para no perder cambios útiles en candidatos que ya estás siguiendo.</p>
          </div>
          <a href="/company/candidates" className="text-sm font-semibold text-slate-900 underline underline-offset-2">Abrir candidatos</a>
        </div>
        <div className="mt-4 space-y-3">
          {visibleNotifications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
              Todavía no hay notificaciones internas. Guarda o preselecciona candidatos para recibir avisos cuando completen onboarding o avancen en verificaciones.
            </div>
          ) : (
            visibleNotifications.map((item) => (
              <article key={item.id} className={`rounded-2xl border p-4 ${item.tone}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{item.title}</p>
                      <span className="rounded-full border border-white/70 bg-white/70 px-2 py-0.5 text-[11px] font-semibold">
                        {item.type === "onboarding" ? "Onboarding" : item.type === "experiences" ? "Experiencias" : item.type === "verification" ? "Verificación" : "Evidencias"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm opacity-90">{item.detail}</p>
                    <p className="mt-2 text-xs opacity-75">Última actividad {formatDate(item.timestamp)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href={item.href} className="inline-flex rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100">
                      {item.cta}
                    </a>
                    <button
                      type="button"
                      onClick={() => markNotificationRead(item.id)}
                      className="inline-flex rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white"
                    >
                      Marcar leída
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Base RRHH</h2>
              <p className="mt-1 text-sm text-slate-600">Tus candidatos importados como base interna ligera para seguimiento diario.</p>
            </div>
            <a href="/company/candidates" className="text-sm font-semibold text-slate-900 underline underline-offset-2">Abrir base completa</a>
          </div>

          {!importsAvailable ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
              La base RRHH aún no está activada en esta base. El espacio queda preparado para usar importaciones y seguimiento en cuanto esté disponible.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {rrhhRows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                  No tienes candidatos en la base interna todavía. El mejor siguiente paso es importar un CV o revisar candidatos ya compartidos.
                </div>
              ) : (
                rrhhRows.map((item) => {
                  const badge = importBadge(item.display_status);
                  return (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {item.linked_profile_name || item.candidate_name_raw || item.candidate_email || "Candidato"}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">{item.target_role || "Sin puesto definido"}</p>
                          <p className="mt-1 text-xs text-slate-500">Última actividad {formatDate(item.last_activity_at || item.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badge.tone}`}>{badge.label}</span>
                          {item.company_stage && item.company_stage !== "none" ? (
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                              item.company_stage === "preselected"
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 bg-slate-100 text-slate-700"
                            }`}>
                              {item.company_stage === "preselected" ? "Preseleccionado" : "Guardado"}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Acciones rápidas</h2>
          <p className="mt-1 text-sm text-slate-600">Atajos a las zonas que más mueven el trabajo diario.</p>
          <div className="mt-4 grid gap-3">
            <a href="/company/profile" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100">
              <p className="text-sm font-semibold text-slate-900">Completar perfil empresa</p>
              <p className="mt-1 text-sm text-slate-600">Refuerza credibilidad, segmentación y cobertura operativa.</p>
            </a>
            <a href="/company/team" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100">
              <p className="text-sm font-semibold text-slate-900">Gestionar equipo y permisos</p>
              <p className="mt-1 text-sm text-slate-600">Controla plazas activas e invitaciones.</p>
            </a>
            <a href="/company/settings" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100">
              <p className="text-sm font-semibold text-slate-900">Ajustes operativos</p>
              <p className="mt-1 text-sm text-slate-600">Configura el área empresa y mantén contexto operativo a mano.</p>
            </a>
          </div>
        </article>
      </section>
    </div>
  );
}
