"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import CandidateQuickView from "@/components/company/CandidateQuickView";
import { COMPANY_PROFILE_UNLOCKED_EVENT } from "@/components/company/ProfileUnlockAction";
import { resolveCompanyDisplayName } from "@/lib/company/company-profile";
import {
  computeCandidateQuickFit,
  resolveCandidateDisplayName,
  resolveCandidateOperationalStateMeta,
  type CompanyCandidateWorkspaceRow,
} from "@/lib/company/candidate-fit";
import { normalizeCandidatePublicToken } from "@/lib/public/candidate-public-link";

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
  available_profile_accesses?: number;
  company_verification_status?: string;
  company_document_verification_status?: string;
  company_document_verification_label?: string;
  company_document_verification_detail?: string | null;
  company_document_last_submitted_at?: string | null;
  company_document_last_reviewed_at?: string | null;
  company_document_review_eta_at?: string | null;
  company_document_review_eta_label?: string | null;
  company_document_review_priority_label?: string | null;
  company_verification_method?: "domain" | "documents" | "both" | "none";
  company_verification_method_label?: string;
  company_verification_method_detail?: string | null;
  current_period_end?: string | null;
  profile_completeness_score?: number;
  kpis?: Kpis | null;
  verification_activity?: {
    pending?: number;
    verified?: number;
    rejected?: number;
  } | null;
  recent_requests?: RecentRequest[] | null;
  recent_access_purchases?: Array<{
    id: string;
    product_key?: string | null;
    credits_granted?: number | null;
    amount?: number | null;
    currency?: string | null;
    created_at?: string | null;
  }> | null;
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

type CandidateImportRow = CompanyCandidateWorkspaceRow & {
  id: string;
  candidate_email?: string | null;
  invite_token?: string | null;
};

type CandidatesPayload = {
  imports?: CandidateImportRow[] | null;
  imports_meta?: { available?: boolean } | null;
  available_profile_accesses?: number;
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

type CandidateFocusTab = "priority" | "verified" | "in_process" | "unverified";

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
  if (status === "verified") return "Verificada documentalmente";
  if (status === "uploaded") return "Documento recibido";
  if (status === "under_review") return "En revisión";
  if (status === "rejected") return "Requiere corrección";
  return "Sin documento";
}

function purchaseLabel(productKeyRaw: unknown) {
  const key = String(productKeyRaw || "").toLowerCase();
  if (key === "company_single_cv") return "Compra de 1 acceso";
  if (key === "company_pack_5") return "Compra pack de 5";
  return "Compra de accesos";
}

function eurFromCents(amountRaw: unknown, currencyRaw: unknown) {
  const amount = Number(amountRaw || 0) / 100;
  const currency = String(currencyRaw || "EUR").toUpperCase();
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function ProgressBar({ value, tone }: { value: number; tone: string }) {
  return (
    <div className="h-2 rounded-full bg-slate-200">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function StatPill({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "blue" | "green" | "amber" | "rose" | "violet";
}) {
  const toneClass =
    tone === "blue"
      ? "border-blue-200 bg-blue-50 text-blue-900"
      : tone === "green"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : tone === "amber"
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : tone === "rose"
            ? "border-rose-200 bg-rose-50 text-rose-900"
            : tone === "violet"
              ? "border-violet-200 bg-violet-50 text-violet-900"
              : "border-slate-200 bg-white/80 text-slate-700";

  return (
    <div className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${toneClass}`}>
      <span className="opacity-75">{label}</span>{" "}
      <span>{value}</span>
    </div>
  );
}

function DashboardSectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-3xl">
        {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p> : null}
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function TacticalActionCard({
  title,
  detail,
  cta,
  href,
  tone = "slate",
}: {
  title: string;
  detail: string;
  cta: string;
  href: string;
  tone?: "slate" | "blue" | "green" | "amber" | "rose" | "violet";
}) {
  const toneClass =
    tone === "blue"
      ? "border-blue-200 bg-blue-50/80"
      : tone === "green"
        ? "border-emerald-200 bg-emerald-50/80"
        : tone === "amber"
          ? "border-amber-200 bg-amber-50/90"
          : tone === "rose"
            ? "border-rose-200 bg-rose-50/90"
            : tone === "violet"
              ? "border-violet-200 bg-violet-50/90"
              : "border-slate-200 bg-white";

  return (
    <a href={href} className={`rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-sm ${toneClass}`}>
      <p className="text-sm font-semibold text-slate-950">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
      <div className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">{cta}</div>
    </a>
  );
}

function QueueItem({
  tone,
  title,
  detail,
  meta,
  action,
}: {
  tone: string;
  title: string;
  detail: string;
  meta: string;
  action: ReactNode;
}) {
  return (
    <article className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-sm opacity-90">{detail}</p>
          <p className="mt-2 text-xs opacity-75">{meta}</p>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
    </article>
  );
}

function accessStateMeta(row: CandidateImportRow, availableProfileAccesses: number) {
  const accessStatus = String(row.access_status || "").toLowerCase();
  if (accessStatus === "active") {
    return {
      label: "Desbloqueado",
      helper: "Ya disponible sin nuevo consumo dentro de la ventana",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
      buttonTone: "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100",
      cta: "Abrir perfil completo",
    };
  }
  if (availableProfileAccesses > 0) {
    return {
      label: "Disponible para abrir",
      helper: "Desbloquea contexto completo",
      tone: "border-amber-200 bg-amber-50 text-amber-900",
      buttonTone: "border-slate-900 bg-slate-900 text-white hover:bg-black",
      cta: "Ver perfil completo (-1 acceso)",
    };
  }
  return {
    label: "Sin accesos",
    helper: "Ahora mismo solo puedes revisar el resumen",
    tone: "border-rose-200 bg-rose-50 text-rose-900",
    buttonTone: "border-rose-200 bg-rose-50 text-rose-900 cursor-not-allowed",
    cta: "Sin accesos disponibles",
  };
}

function humanConfidenceSummary(approved: number, inProcess: number) {
  if (approved >= 2 && inProcess > 0) return `${approved} experiencias verificadas · ${inProcess} en proceso`;
  if (approved >= 2) return `${approved} experiencias verificadas`;
  if (approved === 1 && inProcess > 0) return `1 experiencia verificada · ${inProcess} en proceso`;
  if (approved === 1) return "1 experiencia verificada";
  if (inProcess > 0) return `${inProcess} verificaci${inProcess === 1 ? "ón" : "ones"} en proceso`;
  return "Sin verificaciones todavía";
}

function resolvePriorityReason(row: CandidateImportRow, approved: number, fitLabel: string) {
  const stage = String(row.company_stage || "").toLowerCase();
  if (stage === "preselected") return "Prioritario por preselección";
  if (approved > 0) return "Prioritario por verificaciones aprobadas";
  if (fitLabel === "Alta confianza") return "Prioritario por alta confianza";
  return null;
}

function resolvePriorityFamily(row: CandidateImportRow, approved: number) {
  const stage = String(row.company_stage || "").toLowerCase();
  if (stage === "preselected" || stage === "saved") {
    return {
      label: "Prioridad de negocio",
      tone: "border-indigo-200 bg-indigo-50 text-indigo-800",
    };
  }
  if (approved > 0) {
    return {
      label: "Prioridad por confianza",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }
  return null;
}

function candidateEmptyState(tab: CandidateFocusTab) {
  if (tab === "verified") {
    return {
      title: "Todavía no hay candidatos verificados",
      detail: "Empieza revisando perfiles en proceso o importando nuevos candidatos con señales de confianza.",
      href: "/company/candidates",
      cta: "Importar primer CV",
    };
  }
  if (tab === "priority") {
    return {
      title: "No hay candidatos prioritarios ahora mismo",
      detail: "Revisa candidatos en proceso o desbloquea perfiles para generar una cola de decisión más fuerte.",
      href: "/company/candidates",
      cta: "Importar primer CV",
    };
  }
  if (tab === "in_process") {
    return {
      title: "No hay verificaciones en proceso ahora mismo",
      detail: "Cuando un candidato esté validando experiencia, aparecerá aquí para que puedas seguir su avance.",
      href: "/company/requests",
      cta: "Revisar solicitudes",
    };
  }
  return {
    title: "No hay candidatos sin validar en esta vista",
    detail: "Importa nuevos candidatos o vuelve a revisar tu base completa para ampliar la cobertura.",
    href: "/company/candidates",
    cta: "Importar primer CV",
  };
}

export const dynamic = "force-dynamic";

export default function CompanyDashboard() {
  const searchParams = useSearchParams();
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [profileData, setProfileData] = useState<ProfilePayload | null>(null);
  const [teamData, setTeamData] = useState<TeamPayload | null>(null);
  const [candidateData, setCandidateData] = useState<CandidatesPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [quickViewRow, setQuickViewRow] = useState<CandidateImportRow | null>(null);
  const [candidateTab, setCandidateTab] = useState<CandidateFocusTab>("priority");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("vj_company_candidate_notifications_read");
      const parsed = raw ? JSON.parse(raw) : [];
      setReadNotificationIds(Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : []);
    } catch {
      setReadNotificationIds([]);
    }
  }, []);

  async function loadDashboardData() {
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
      setDashboard(dashboardBody || {});
      setProfileData(profileRes.ok ? profileBody || {} : null);
      setTeamData(teamRes.ok ? teamBody || {} : null);
      setCandidateData(candidateRes.ok ? candidateBody || {} : null);
      setErrorMessage(null);
    } catch (e: any) {
      setErrorMessage(e?.message || "No se pudo cargar el panel de empresa.");
    }
  }

  useEffect(() => {
    (async () => {
      await loadDashboardData();
    })();
  }, []);

  useEffect(() => {
    const checkoutState = String(searchParams.get("checkout") || "");
    if (checkoutState === "cancel") {
      setCheckoutMessage("La compra no se completó. Puedes seguir operando y volver a intentarlo cuando quieras.");
      return;
    }
    if (checkoutState !== "success") return;

    setCheckoutMessage("Pago recibido. Estamos actualizando tus accesos disponibles.");
    let cancelled = false;
    let attempts = 0;
    const interval = window.setInterval(async () => {
      if (cancelled) return;
      attempts += 1;
      await loadDashboardData();
      if (attempts >= 4) {
        window.clearInterval(interval);
        if (!cancelled) {
          setCheckoutMessage("Compra completada. El saldo ya debería reflejarse en el panel.");
        }
      }
    }, 2500);

    void loadDashboardData();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [searchParams]);

  useEffect(() => {
    const handleUnlocked = (event: Event) => {
      const detail = (event as CustomEvent<any>).detail || {};
      const candidateToken = normalizeCandidatePublicToken(detail?.candidateToken);
      const unlockedAt = String(detail?.unlocked_at || "").trim() || null;
      const unlockedUntil = String(detail?.unlocked_until || "").trim() || null;
      const remaining = Number(detail?.remaining_accesses || 0);
      if (!candidateToken) return;

      setCandidateData((prev) =>
        prev
          ? {
              ...prev,
              available_profile_accesses: remaining,
              imports: Array.isArray(prev.imports)
                ? prev.imports.map((item: any) =>
                    normalizeCandidatePublicToken(item?.candidate_public_token) === candidateToken
                      ? {
                          ...item,
                          access_status: "active",
                          access_granted_at: unlockedAt,
                          access_expires_at: unlockedUntil,
                        }
                      : item,
                  )
                : prev.imports,
            }
          : prev,
      );
      setQuickViewRow((prev) =>
        prev && normalizeCandidatePublicToken((prev as any)?.candidate_public_token) === candidateToken
          ? {
              ...prev,
              access_status: "active",
              access_granted_at: unlockedAt,
              access_expires_at: unlockedUntil,
            }
          : prev,
      );
    };

    window.addEventListener(COMPANY_PROFILE_UNLOCKED_EVENT, handleUnlocked as EventListener);
    return () => window.removeEventListener(COMPANY_PROFILE_UNLOCKED_EVENT, handleUnlocked as EventListener);
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
  const verificationStatus = dashboard?.company_document_verification_status || dashboard?.company_verification_status || "none";
  const verificationStatusLabelText = dashboard?.company_document_verification_label || verificationStatusLabel(verificationStatus);
  const verificationStatusDetail = dashboard?.company_document_verification_detail || null;
  const verificationMethod = dashboard?.company_verification_method || "none";
  const verificationMethodLabel = dashboard?.company_verification_method_label || "Sin señal adicional confirmada";
  const profileCompletion = Number(profileData?.profile_completion?.score ?? dashboard?.profile_completeness_score ?? 0);
  const kpis = dashboard?.kpis || null;
  const recentRequests = useMemo(
    () => (Array.isArray(dashboard?.recent_requests) ? dashboard.recent_requests : []),
    [dashboard?.recent_requests]
  );
  const imports = useMemo(
    () => (Array.isArray(candidateData?.imports) ? candidateData.imports : []),
    [candidateData?.imports]
  );
  const importsAvailable = candidateData?.imports_meta?.available !== false;
  const availableProfileAccesses = Number(candidateData?.available_profile_accesses ?? dashboard?.available_profile_accesses ?? 0);
  const seatsLimit = Number(teamData?.plan?.seats_limit || 0);
  const seatsUsed = Number(teamData?.plan?.seats_used || 0);
  const pendingInvitations = Number(teamData?.plan?.pending_invitations || 0);
  const seatUsagePct = seatsLimit > 0 ? Math.round(((seatsUsed + pendingInvitations) / seatsLimit) * 100) : 0;

  const candidateDecisionRows = useMemo(() => {
    return imports
      .map((item) => {
        const fit = computeCandidateQuickFit(item);
        const approved = Math.max(0, Number(item.approved_verifications || 0));
        const total = Math.max(0, Number(item.total_verifications || 0));
        const inProcess = Math.max(0, total - approved);
        const unverified = total === 0 ? 1 : 0;
        const confidenceLabel =
          fit.level === "high" ? "Alta confianza" : fit.level === "medium" ? "Confianza media" : "Sin validar";
        const priorityWeight =
          (fit.level === "high" ? 300 : fit.level === "medium" ? 200 : 100) +
          approved * 25 +
          (String(item.company_stage || "").toLowerCase() === "preselected" ? 10 : 0);

        return { row: item, fit, approved, inProcess, unverified, confidenceLabel, priorityWeight };
      })
      .filter((item) => {
        if (candidateTab === "verified") return item.approved > 0 || item.fit.level === "high";
        if (candidateTab === "in_process") {
          return item.inProcess > 0 || String(item.row.display_status || "").toLowerCase() === "in_review";
        }
        if (candidateTab === "unverified") return item.approved === 0 && item.inProcess === 0;
        return true;
      })
      .sort((a, b) => {
        return (
          b.priorityWeight - a.priorityWeight ||
          Date.parse(String(b.row.last_activity_at || b.row.created_at || 0)) -
            Date.parse(String(a.row.last_activity_at || a.row.created_at || 0))
        );
      });
  }, [candidateTab, imports]);

  const notifications = useMemo<NotificationItem[]>(() => {
    return imports
      .filter((item) => item.company_stage === "saved" || item.company_stage === "preselected")
      .flatMap((item) => {
        const label = item.linked_profile_name || item.candidate_name_raw || item.candidate_email || "Candidato";
        const href = item.candidate_public_token ? `/company/candidate/${item.candidate_public_token}` : "/company/candidates";
        const rows: NotificationItem[] = [];
        if (item.display_status === "ready") {
          rows.push({
            id: `${item.id}-onboarding`,
            tone: "border-indigo-200 bg-indigo-50 text-indigo-900",
            title: `${label} ya está listo para revisión`,
            detail: "El perfil ya está disponible para revisar en resumen parcial antes de acceder al perfil completo.",
            href,
            cta: "Revisar candidato",
            timestamp: item.last_activity_at || item.created_at || null,
            type: "onboarding",
          });
        }
        if (item.display_status === "ready") {
          rows.push({
            id: `${item.id}-experiences`,
            tone: "border-slate-200 bg-slate-50 text-slate-900",
            title: `${label} ya tiene propuesta revisable`,
            detail: "Puedes revisar la propuesta actual y decidir si merece abrir el perfil completo.",
            href,
            cta: "Ver resumen",
            timestamp: item.last_activity_at || item.created_at || null,
            type: "experiences",
          });
        }
        if (item.display_status === "in_review") {
          rows.push({
            id: `${item.id}-verifying`,
            tone: "border-blue-200 bg-blue-50 text-blue-900",
            title: `${label} está en revisión`,
            detail: "La importación sigue en revisión y conviene comprobar su progreso.",
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
        if (item.display_status === "in_review" || (Number(item.total_verifications || 0) > 0 && Number(item.approved_verifications || 0) === 0)) {
          rows.push({
            id: `${item.id}-evidences`,
            tone: "border-amber-200 bg-amber-50 text-amber-900",
            title: `${label} ha subido evidencias o documentación`,
            detail: "El perfil ya tiene material adicional para apoyar la validación.",
            href,
            cta: "Revisar resumen",
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
  const activeAccessCount = useMemo(
    () => imports.filter((item) => String(item.access_status || "").toLowerCase() === "active").length,
    [imports]
  );
  const expiredAccessCount = useMemo(
    () => imports.filter((item) => String(item.access_status || "").toLowerCase() === "expired").length,
    [imports]
  );
  const recentAccessPurchases = Array.isArray(dashboard?.recent_access_purchases) ? dashboard.recent_access_purchases : [];
  const pendingRequestCount = Number(kpis?.pending_requests ?? recentRequests.filter((item) => item.status === "pending").length);
  const recentVerifiedCount = Number(dashboard?.verification_activity?.verified ?? kpis?.verified_30d ?? 0);
  const pendingVerificationCount = Number(dashboard?.verification_activity?.pending ?? 0);
  const readyToReviewCount = imports.filter((item) => String(item.display_status || "").toLowerCase() === "ready").length;
  const newCandidateCount = imports.filter((item) => String(item.display_status || "").toLowerCase() === "new").length;
  const highSignalCandidateCount = imports.filter((item) => {
    const fit = computeCandidateQuickFit(item);
    return fit.level === "high" || Number(item.approved_verifications || 0) > 0;
  }).length;
  const hasCandidates = imports.length > 0;
  const focusMetricLabel =
    availableProfileAccesses > 0
      ? "accesos listos para abrir contexto"
      : pendingRequestCount > 0
        ? "solicitudes listas para resolver"
        : `${highSignalCandidateCount} perfiles con señal`;

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

  async function handleSetCandidateStage(inviteId: string, stage: "saved" | "preselected" | "none") {
    setActionLoading(inviteId);
    try {
      const res = await fetch("/api/company/candidate-imports", {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invite_id: inviteId, company_stage: stage }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.user_message || body?.details || body?.error || "No se pudo actualizar el candidato.");
      }

      setCandidateData((prev) => {
        const imports = Array.isArray(prev?.imports) ? prev.imports : [];
        return {
          ...(prev || {}),
          imports: imports.map((row) =>
            String((row as any)?.id || "") === inviteId
              ? {
                  ...row,
                  company_stage: stage,
                  last_activity_at: body?.invite?.last_activity_at || new Date().toISOString(),
                }
              : row,
          ),
        };
      });

      setQuickViewRow((prev) =>
        prev && String(prev.id) === inviteId ? { ...prev, company_stage: stage } : prev,
      );
    } catch (error: any) {
      setErrorMessage(error?.message || "No se pudo actualizar el estado interno del candidato.");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-6 pb-6">
      {checkoutMessage ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {checkoutMessage}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(191,219,254,0.42),_transparent_42%),linear-gradient(135deg,_#0f172a_0%,_#172554_48%,_#eef2ff_100%)] shadow-[0_20px_64px_rgba(15,23,42,0.14)]">
        <div className="grid gap-5 p-6 md:p-6 xl:grid-cols-[minmax(0,1.2fr)_300px] xl:items-start">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-100/80">Workspace empresa</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-[2.25rem]">{companyName}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-100/85">
              {hasCandidates
                ? "Decide más rápido qué candidatos merecen revisión a fondo, qué perfiles ya aportan señal real y dónde conviene consumir accesos."
                : "Empieza subiendo el CV de tu primer candidato para generar un resumen y decidir con más contexto."}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <StatPill label="Plan" value={planLabel} tone="violet" />
              <StatPill label="Accesos" value={String(availableProfileAccesses)} tone={availableProfileAccesses > 0 ? "green" : "rose"} />
              <StatPill label="Nuevos" value={String(newCandidateCount)} tone={newCandidateCount > 0 ? "blue" : "slate"} />
              <StatPill label="Desbloqueados" value={String(activeAccessCount)} tone={activeAccessCount > 0 ? "green" : "slate"} />
              <StatPill label="Solicitudes" value={String(pendingRequestCount)} tone={pendingRequestCount > 0 ? "amber" : "slate"} />
              <StatPill label="Verificaciones" value={String(recentVerifiedCount)} tone={recentVerifiedCount > 0 ? "green" : "slate"} />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-3xl border border-white/15 bg-white/10 p-4 text-white backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100/75">Estado del panel</p>
                <p className="mt-2 text-base font-semibold">{hasCandidates ? "Listo para decisión" : "Empieza aquí"}</p>
                <p className="mt-2 text-sm leading-6 text-blue-100/80">
                  {hasCandidates
                    ? verificationStatusDetail || "Tienes la base lista para revisar resúmenes, priorizar señal y desbloquear cuando de verdad compense."
                    : "Tu siguiente paso útil es subir un CV. Primero verás un resumen y solo abrirás el perfil completo cuando te compense."}
                </p>
              </div>
              <div className="rounded-3xl border border-white/15 bg-white/10 p-4 text-white backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100/75">Workspace y señal</p>
                <p className="mt-2 text-base font-semibold">{verificationStatusLabelText}</p>
                <p className="mt-2 text-sm leading-6 text-blue-100/80">
                  {dashboard?.company_verification_method_detail || verificationMethodLabel}
                </p>
              </div>
              <div className="rounded-3xl border border-white/15 bg-white/10 p-4 text-white backdrop-blur sm:col-span-2 xl:col-span-1">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100/75">Perfil empresa</p>
                <p className="mt-2 text-base font-semibold">{profileCompletion}% completado</p>
                <div className="mt-3">
                  <ProgressBar value={profileCompletion} tone="bg-white" />
                </div>
                <p className="mt-2 text-sm text-blue-100/80">
                  Obligatorio {Number(profileData?.profile_completion?.required?.completed || 0)}/{Number(profileData?.profile_completion?.required?.total || 0)} · Recomendado {Number(profileData?.profile_completion?.recommended?.completed || 0)}/{Number(profileData?.profile_completion?.recommended?.total || 0)}
                </p>
              </div>
            </div>

            {errorMessage ? <p className="mt-4 text-sm text-rose-200">{errorMessage}</p> : null}
          </div>

          <aside className="rounded-[26px] border border-white/15 bg-white/95 p-5 shadow-[0_16px_48px_rgba(15,23,42,0.16)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Capacidad actual</p>
            <div className="mt-3 text-5xl font-semibold tracking-tight text-slate-950">{availableProfileAccesses}</div>
            <p className="mt-2 text-sm font-medium text-slate-700">{focusMetricLabel}</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {availableProfileAccesses > 0
                ? "Ahora mismo puedes abrir perfiles completos cuando la señal lo justifique."
                : "Ahora mismo conviene priorizar resúmenes y detectar primero qué perfiles merecen contexto completo."}
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Listos para revisar</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{readyToReviewCount}</p>
                <p className="mt-1 text-xs text-slate-500">Perfiles ya maduros para una revisión rápida.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Señal alta</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{highSignalCandidateCount}</p>
                <p className="mt-1 text-xs text-slate-500">Perfiles que ya aportan contexto útil.</p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <Link href="/company/candidates" className="inline-flex justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-black">
                {hasCandidates ? "Revisar candidatos" : "Subir primer CV"}
              </Link>
              <a href="/company/requests" className="inline-flex justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                Revisar solicitudes
              </a>
            </div>
          </aside>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
          <DashboardSectionTitle
            eyebrow="Accesos y capacidad"
            title="Tus accesos no compran perfiles: compran contexto para decidir mejor."
            description="Haz visible cuánta capacidad real tienes hoy, qué perfiles ya están desbloqueados y dónde conviene usar el siguiente acceso."
            action={
              <a href="/company/subscription" className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                Ver planes y accesos
              </a>
            }
          />

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="rounded-[28px] border border-blue-200 bg-blue-50/80 p-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-900">Capacidad disponible</p>
                  <div className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">{availableProfileAccesses}</div>
                  <p className="mt-2 text-sm text-slate-700">
                    {availableProfileAccesses > 0
                      ? "Puedes abrir perfiles completos cuando el resumen ya demuestre suficiente señal."
                      : "Ahora mismo puedes seguir revisando resúmenes, pero no abrir la versión completa cuando un perfil realmente promete."}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/80 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                  <div className="font-semibold text-slate-950">{activeAccessCount} perfiles desbloqueados</div>
                  <div className="mt-1 text-xs text-slate-500">{expiredAccessCount} accesos caducados listos para renovar</div>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/80 bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Accesos activos</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{activeAccessCount}</p>
                </div>
                <div className="rounded-2xl border border-white/80 bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Solicitudes pendientes</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{pendingRequestCount}</p>
                </div>
                <div className="rounded-2xl border border-white/80 bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Señal alta</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{highSignalCandidateCount}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Qué ocurre cuando se consumen</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Cada acceso abre contexto completo para decidir mejor. Si el perfil sigue dentro de la ventana activa, puedes volver a entrar sin consumir otro.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Plan actual y equipo</p>
                <p className="mt-2 text-sm text-slate-600">
                  Plan {planLabel} · {seatsUsed} plazas activas · {pendingInvitations} invitaciones pendientes.
                </p>
                <div className="mt-3">
                  <ProgressBar value={seatUsagePct} tone={seatUsagePct >= 85 ? "bg-amber-500" : "bg-violet-600"} />
                </div>
              </div>
              <div className={`rounded-2xl border p-4 ${availableProfileAccesses > 0 ? "border-emerald-200 bg-emerald-50/80" : "border-rose-200 bg-rose-50/90"}`}>
                <p className="text-sm font-semibold text-slate-900">{availableProfileAccesses > 0 ? "Capacidad lista para decidir" : "Coste de oportunidad visible"}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {availableProfileAccesses > 0
                    ? "Usa primero los resúmenes con señal alta y reserva el unlock para los perfiles que ya reducen incertidumbre."
                    : "Seguir navegando resúmenes sirve para priorizar, pero te falta el contexto completo justo cuando un candidato ya empieza a prometer."}
                </p>
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <DashboardSectionTitle
            eyebrow="Qué hacer ahora"
            title="Tres movimientos útiles para hoy"
            description="Acciones cortas, sin rodeos, para avanzar la decisión y no solo navegar el panel."
          />
          <div className="mt-4 grid gap-3">
            <TacticalActionCard
              title={hasCandidates ? (highSignalCandidateCount > 0 ? "Revisar perfiles con más señal" : "Abrir la base y buscar señal") : "Sube tu primer CV"}
              detail={hasCandidates ? (highSignalCandidateCount > 0 ? `${highSignalCandidateCount} candidatos ya aportan contexto útil para priorizar revisión a fondo.` : "Todavía no hay perfiles con señal fuerte. Empieza por la base y detecta resúmenes prometedores.") : "Primero verás un resumen del candidato. Solo abrirás el perfil completo cuando te compense."}
              cta={hasCandidates ? "Ir a candidatos" : "Subir primer CV"}
              href="/company/candidates"
              tone={hasCandidates && highSignalCandidateCount > 0 ? "green" : "blue"}
            />
            <TacticalActionCard
              title={pendingRequestCount > 0 ? "Resolver solicitudes pendientes" : "Mantener la cola vacía"}
              detail={pendingRequestCount > 0 ? `Tienes ${pendingRequestCount} solicitudes esperando resolución o seguimiento.` : "No hay solicitudes urgentes. Buen momento para revisar candidatos listos para decisión."}
              cta="Abrir solicitudes"
              href="/company/requests"
              tone={pendingRequestCount > 0 ? "amber" : "slate"}
            />
            <TacticalActionCard
              title={profileCompletion < 100 ? "Completar perfil empresa" : "Refinar capacidad del workspace"}
              detail={profileCompletion < 100 ? `Tu perfil empresa va por ${profileCompletion}%. Más contexto mejora credibilidad y operativa.` : "Tu perfil empresa ya está cubierto. El siguiente salto útil es ampliar equipo o accesos."}
              cta={profileCompletion < 100 ? "Ir al perfil empresa" : "Gestionar plan"}
              href={profileCompletion < 100 ? "/company/profile" : "/company/subscription"}
              tone={profileCompletion < 100 ? "blue" : "violet"}
            />
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_360px] xl:items-start">
        <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm xl:p-7">
          <DashboardSectionTitle
            eyebrow="Candidatos para decidir"
            title="Candidatos para decidir"
            description="Aquí decides rápido quién merece revisión a fondo y quién todavía no tiene suficiente señal."
            action={<a href="/company/candidates" className="text-sm font-semibold text-slate-900 underline underline-offset-2">Abrir base completa</a>}
          />

          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
            Prioriza primero los perfiles con señales verificadas. Abrir sin contexto cuesta más decisiones y más tiempo.
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {[
              { key: "priority", label: "Prioritarios" },
              { key: "verified", label: "Verificados" },
              { key: "in_process", label: "En proceso" },
              { key: "unverified", label: "Sin validar" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCandidateTab(tab.key as CandidateFocusTab)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  candidateTab === tab.key
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {candidateTab === "priority" ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <StatPill label="Negocio" value="guardado o preselección" tone="blue" />
              <StatPill label="Confianza" value="validaciones o trust alto" tone="green" />
            </div>
          ) : null}

          <div className="mt-6 space-y-4">
            {!importsAvailable ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                La base RRHH aún no está activada en esta empresa. El dashboard queda preparado para decidir en cuanto haya importaciones disponibles.
              </div>
            ) : candidateDecisionRows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">{candidateEmptyState(candidateTab).title}</p>
                <p className="mt-2 text-sm text-slate-600">{candidateEmptyState(candidateTab).detail}</p>
                <Link href={candidateEmptyState(candidateTab).href} className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black">
                  {candidateEmptyState(candidateTab).cta}
                </Link>
              </div>
            ) : (
              candidateDecisionRows.slice(0, 8).map(({ row, fit, approved, inProcess, unverified }) => {
                const operational = resolveCandidateOperationalStateMeta(row);
                const displayName = resolveCandidateDisplayName(row);
                const stage = String(row.company_stage || "none").toLowerCase();
                const access = accessStateMeta(row, availableProfileAccesses);
                const trustScore = Number(row.trust_score ?? 0);
                const confidenceSummary = humanConfidenceSummary(approved, inProcess);
                const priorityReason = candidateTab === "priority" ? resolvePriorityReason(row, approved, fit.label === "Encaje alto" ? "Alta confianza" : fit.label) : null;
                const priorityFamily = candidateTab === "priority" ? resolvePriorityFamily(row, approved) : null;

                return (
                  <article
                    key={row.id}
                    className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,_rgba(248,250,252,0.96)_0%,_#ffffff_100%)] p-5 shadow-[0_10px_35px_rgba(15,23,42,0.05)] transition hover:border-slate-300 hover:shadow-[0_16px_45px_rgba(15,23,42,0.08)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <button type="button" onClick={() => setQuickViewRow(row)} className="text-left text-lg font-semibold text-slate-950 hover:text-slate-700">
                            {displayName}
                          </button>
                          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${fit.tone}`}>{fit.label}</span>
                          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${operational.tone}`}>{operational.label}</span>
                          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${access.tone}`}>{access.label}</span>
                          {priorityFamily ? <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${priorityFamily.tone}`}>{priorityFamily.label}</span> : null}
                        </div>
                        <p className="mt-2 text-sm font-medium text-slate-800">{row.target_role || "Puesto no definido"}</p>
                        <p className="mt-1 text-sm text-slate-600">{row.candidate_email || "Email no disponible"}</p>
                        <p className="mt-3 text-sm text-slate-700">{approved > 0 ? "Perfil con señal real" : inProcess > 0 ? "Señal parcial" : "Poca señal verificable"}</p>
                        <p className="mt-1 text-xs text-slate-500">{confidenceSummary}</p>
                        {priorityReason ? <p className="mt-1 text-xs font-medium text-slate-500">{priorityReason}</p> : null}
                      </div>

                  <div className="grid gap-2 sm:min-w-[260px] sm:grid-cols-3 xl:min-w-[300px]">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Trust score</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-950">{trustScore > 0 ? trustScore : "—"}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Verificaciones</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-950">{approved}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">En curso</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-950">{inProcess}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <p className="text-xs font-semibold text-slate-500">Estado acceso</p>
                          <p className="mt-1 text-sm font-semibold text-slate-950">{access.label}</p>
                          <p className="mt-1 text-xs text-slate-500">{access.helper}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <p className="text-xs font-semibold text-slate-500">Última actividad</p>
                          <p className="mt-1 text-sm font-semibold text-slate-950">{formatDate(row.last_activity_at || row.created_at)}</p>
                          <p className="mt-1 text-xs text-slate-500">{unverified} sin validar</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <p className="text-xs font-semibold text-slate-500">Siguiente lectura</p>
                          <p className="mt-1 text-sm font-semibold text-slate-950">{approved > 0 ? "Abrir con menos riesgo" : "Validar antes de abrir"}</p>
                          <p className="mt-1 text-xs text-slate-500">{fit.summary}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 xl:justify-end">
                        <div className="space-y-1">
                          <button
                            type="button"
                            onClick={() => setQuickViewRow(row)}
                            className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                          >
                            Ver resumen
                          </button>
                          <p className="text-[11px] font-medium text-slate-500">Vista parcial sin consumo</p>
                        </div>
                        <div className="space-y-1">
                          <button
                            type="button"
                            onClick={() => setQuickViewRow(row)}
                            className={`inline-flex rounded-xl border px-4 py-2.5 text-sm font-semibold ${access.buttonTone}`}
                          >
                            {access.cta}
                          </button>
                          <p className="text-[11px] font-medium text-slate-500">{access.helper}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleSetCandidateStage(row.id, stage === "saved" ? "none" : "saved")}
                          disabled={actionLoading === row.id}
                          className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                        >
                          {stage === "saved" ? "Quitar guardado" : "Guardar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSetCandidateStage(row.id, stage === "preselected" ? "none" : "preselected")}
                          disabled={actionLoading === row.id}
                          className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                        >
                          {stage === "preselected" ? "Quitar preselección" : "Preseleccionar"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </article>

        <div className="space-y-5">
          <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
            <DashboardSectionTitle
              eyebrow="Actividad reciente"
              title="Solicitudes, verificaciones y cambios recientes"
              description="Una cola ligera para operar sin saltar de inmediato a otra pantalla."
              action={<a href="/company/requests" className="text-sm font-semibold text-slate-900 underline underline-offset-2">Abrir solicitudes</a>}
            />
            <div className="mt-5 space-y-3">
              {recentRequests.filter((item) => item.status === "pending").slice(0, 3).map((item) => (
                <QueueItem
                  key={`recent-request-${item.id}`}
                  tone="border-amber-200 bg-amber-50/90 text-amber-900"
                  title={item.candidate_name || "Solicitud pendiente"}
                  detail={`${item.position || "Experiencia sin puesto"} · ${item.company_name || "Empresa"}`}
                  meta={`Pendiente desde ${formatDate(item.requested_at)}`}
                  action={
                    <a href={`/company/verification/${item.id}`} className="inline-flex rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100">
                      Resolver
                    </a>
                  }
                />
              ))}

              {visibleNotifications.slice(0, 3).map((item) => (
                <QueueItem
                  key={item.id}
                  tone={item.tone}
                  title={item.title}
                  detail={item.detail}
                  meta={`Última actividad ${formatDate(item.timestamp)}`}
                  action={
                    <div className="flex flex-wrap gap-2">
                      <a href={item.href} className="inline-flex rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100">
                        {item.cta}
                      </a>
                      <button type="button" onClick={() => markNotificationRead(item.id)} className="inline-flex rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white">
                        Leída
                      </button>
                    </div>
                  }
                />
              ))}

              {recentRequests.filter((item) => item.status === "pending").length === 0 && visibleNotifications.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                  No hay actividad urgente visible ahora mismo. Buen momento para revisar candidatos con más señal o activar más accesos.
                </div>
              ) : null}
            </div>
          </article>

          <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
            <DashboardSectionTitle
              eyebrow="Plan y capacidad"
              title="Multiplica tu capacidad de revisión"
              description="Más accesos y más margen operativo cuando realmente valga la pena abrir perfiles completos."
              action={<a href="/company/subscription" className="text-sm font-semibold text-slate-900 underline underline-offset-2">Gestionar plan</a>}
            />

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-violet-200 bg-violet-50/80 p-4">
                <p className="text-sm font-semibold text-slate-950">Plan {planLabel}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {seatsLimit <= 1
                    ? "La colaboración del workspace sigue siendo mínima. Más plazas y más accesos hacen la revisión más fluida."
                    : seatUsagePct >= 85
                      ? "Estás cerca del límite de plazas. El siguiente paso útil es ampliar capacidad para no frenar la revisión."
                      : "Tu plan actual sostiene la operativa de hoy, pero puedes abrir más contexto cuando la cola crezca."}
                </p>
                <div className="mt-3">
                  <ProgressBar value={seatUsagePct} tone={seatUsagePct >= 85 ? "bg-amber-500" : "bg-violet-600"} />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Capacidad comercial visible</p>
                <p className="mt-2 text-sm text-slate-600">
                  {availableProfileAccesses} accesos disponibles · {activeAccessCount} perfiles completos ya abiertos · {pendingVerificationCount} verificaciones pendientes.
                </p>
                {dashboard?.current_period_end ? (
                  <p className="mt-2 text-xs text-slate-500">
                    {dashboard?.subscription_status === "trialing" ? "Trial activo hasta" : "Renovación"} {formatDate(dashboard.current_period_end)}
                  </p>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">Compras recientes</p>
                <div className="mt-3 space-y-2">
                  {recentAccessPurchases.length === 0 ? (
                    <p className="text-sm text-slate-600">Todavía no hay compras recientes visibles.</p>
                  ) : (
                    recentAccessPurchases.slice(0, 2).map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{purchaseLabel(item.product_key)}</p>
                            <p className="mt-1 text-xs text-slate-500">+{Number(item.credits_granted || 0)} accesos · {formatDate(item.created_at)}</p>
                          </div>
                          <span className="text-sm font-semibold text-slate-900">{eurFromCents(item.amount, item.currency)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <a href="/company/subscription" className="inline-flex w-full justify-center rounded-xl bg-violet-700 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-800">
                Activar más accesos
              </a>
            </div>
          </article>
        </div>
      </section>
      <CandidateQuickView
        row={quickViewRow}
        open={Boolean(quickViewRow)}
        onClose={() => setQuickViewRow(null)}
        onSetStage={handleSetCandidateStage}
        actionLoading={actionLoading}
        availableProfileAccesses={availableProfileAccesses}
      />
    </div>
  );
}
