"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import CandidateQuickView from "@/components/company/CandidateQuickView";
import { COMPANY_PROFILE_UNLOCKED_EVENT } from "@/components/company/ProfileUnlockAction";
import { resolveCompanyDisplayName } from "@/lib/company/company-profile";
import {
  computeCandidateQuickFit,
  resolveCandidateDisplayName,
  resolveCandidateOperationalStateMeta,
  resolveCandidatePipelineBucket,
  type CompanyCandidateWorkspaceRow,
} from "@/lib/company/candidate-fit";
import { companyVerificationMethodTone } from "@/lib/company/verification-method";
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

function verificationStatusClass(statusRaw: unknown) {
  const status = String(statusRaw || "").toLowerCase();
  if (status === "verified") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "uploaded" || status === "under_review") return "border-indigo-200 bg-indigo-50 text-indigo-800";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
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
      cta: "Importar candidato",
    };
  }
  if (tab === "priority") {
    return {
      title: "No hay candidatos prioritarios ahora mismo",
      detail: "Revisa candidatos en proceso o desbloquea perfiles para generar una cola de decisión más fuerte.",
      href: "/company/candidates",
      cta: "Revisar candidatos en proceso",
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
    cta: "Importar candidato",
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
  const checklist = Array.isArray(profileData?.profile_completion?.checklist)
    ? profileData?.profile_completion?.checklist?.slice(0, 4)
    : [];
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
      .filter((item) => item.display_status === "new" || item.display_status === "in_review" || item.display_status === "ready")
      .slice(0, 4)
      .forEach((item, index) => {
        const fit = computeCandidateQuickFit(item);
        items.push({
          id: `imp-${item.id}`,
          title: resolveCandidateDisplayName(item),
          detail:
            item.display_status === "new"
              ? "CV recibido y pendiente de revisión inicial."
              : item.display_status === "in_review"
                ? "Importación en revisión con propuesta de cambios disponible."
                : "Candidato listo para decisión en la base RRHH.",
          href: item.candidate_public_token ? `/company/candidate/${item.candidate_public_token}` : "/company/candidates",
          cta: item.candidate_public_token ? "Abrir perfil" : "Abrir base RRHH",
          tone:
            item.display_status === "new"
              ? "border-blue-200 bg-blue-50 text-blue-900"
              : item.display_status === "in_review"
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-violet-200 bg-violet-50 text-violet-900",
          priority: 80 - index,
          meta: `${fit.label} · Última actividad ${formatDate(item.last_activity_at || item.created_at)}`,
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
  const unlockedHistory = useMemo(() => {
    return imports
      .filter((item) => item.access_granted_at)
      .slice()
      .sort(
        (a, b) =>
          Date.parse(String(b.access_granted_at || b.last_activity_at || b.created_at || 0)) -
          Date.parse(String(a.access_granted_at || a.last_activity_at || a.created_at || 0))
      )
      .slice(0, 5);
  }, [imports]);
  const recentAccessPurchases = Array.isArray(dashboard?.recent_access_purchases) ? dashboard.recent_access_purchases : [];
  const activeCandidateCount = imports.length;
  const verifiedCandidateCount = imports.filter((item) => Number(item.approved_verifications || 0) > 0).length;

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
    <div className="space-y-6">
      {checkoutMessage ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {checkoutMessage}
        </section>
      ) : null}
      <section className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Panel de control</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{companyName}</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Vista operativa para decidir rápido qué candidatos merece la pena revisar, desbloquear y mover dentro del proceso.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">Plan {planLabel}</span>
              <span className={`rounded-full border px-3 py-1 font-semibold ${verificationStatusClass(verificationStatus)}`}>{verificationStatusLabelText}</span>
              <span className={`rounded-full border px-3 py-1 font-semibold ${companyVerificationMethodTone(verificationMethod)}`}>{verificationMethodLabel}</span>
              {dashboard?.current_period_end ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
                  {dashboard?.subscription_status === "trialing" ? "Trial activo hasta" : "Próxima renovación"} {formatDate(dashboard.current_period_end)}
                </span>
              ) : null}
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">Perfil {profileCompletion}% listo</span>
            </div>
            {verificationStatusDetail ? <p className="mt-2 text-sm text-slate-600">{verificationStatusDetail}</p> : null}
            {dashboard?.company_document_review_eta_label && (verificationStatus === "uploaded" || verificationStatus === "under_review") ? (
              <p className="mt-1 text-sm text-slate-600">
                Tiempo estimado de revisión: {dashboard.company_document_review_eta_label}
                {dashboard.company_document_review_priority_label ? ` · ${dashboard.company_document_review_priority_label}` : ""}
              </p>
            ) : null}
            {dashboard?.company_verification_method_detail ? (
              <p className="mt-1 text-sm text-slate-500">Señales adicionales: {dashboard.company_verification_method_detail}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/company/candidates" className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black transition">Importar candidato</Link>
            <a href="/company/requests" className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition">Revisar solicitudes</a>
            <a href="/company/subscription" className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition">Plan, capacidad y accesos</a>
          </div>
        </div>
        {errorMessage ? <p className="mt-4 text-sm text-rose-600">{errorMessage}</p> : null}
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Candidatos activos</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{activeCandidateCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Perfiles verificados</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{verifiedCandidateCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Accesos para perfiles completos</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{availableProfileAccesses}</p>
          </div>
        </div>
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

      <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Candidatos para decidir</h2>
              <p className="mt-1 text-sm text-slate-600">Lectura rápida para decidir a quién revisar a fondo, guardar o preseleccionar sin perder contexto.</p>
            </div>
            <a href="/company/candidates" className="text-sm font-semibold text-slate-900 underline underline-offset-2">Abrir base completa</a>
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
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {candidateTab === "priority" ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800">
                Prioridad de negocio: guardado o preselección
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                Prioridad por confianza: verificaciones aprobadas o alta confianza
              </span>
            </div>
          ) : null}

          <div className="mt-5 space-y-4">
            {!importsAvailable ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                La base RRHH aún no está activada en esta base. El panel queda preparado para operar en cuanto la importación esté disponible.
              </div>
            ) : candidateDecisionRows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">{candidateEmptyState(candidateTab).title}</p>
                <p className="mt-2 text-sm text-slate-600">{candidateEmptyState(candidateTab).detail}</p>
                <Link
                  href={candidateEmptyState(candidateTab).href}
                  className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                >
                  {candidateEmptyState(candidateTab).cta}
                </Link>
              </div>
            ) : (
              candidateDecisionRows.slice(0, 8).map(({ row, fit, approved, inProcess, unverified, confidenceLabel }) => {
                const operational = resolveCandidateOperationalStateMeta(row);
                const displayName = resolveCandidateDisplayName(row);
                const stage = String(row.company_stage || "none").toLowerCase();
                const confidenceSummary = humanConfidenceSummary(approved, inProcess);
                const priorityReason = candidateTab === "priority" ? resolvePriorityReason(row, approved, confidenceLabel) : null;
                const priorityFamily = candidateTab === "priority" ? resolvePriorityFamily(row, approved) : null;
                const progressLabel =
                  approved > 0
                    ? "Alta confianza"
                    : inProcess > 0
                      ? "Verificación en proceso"
                      : "Perfil sin validar todavía";
                return (
                  <article
                    key={row.id}
                    className="cursor-pointer rounded-[26px] border border-slate-200 bg-slate-50/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] transition hover:border-slate-300 hover:bg-white"
                    onClick={() => setQuickViewRow(row)}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-slate-900">{displayName}</h3>
                          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${fit.tone}`}>{confidenceLabel}</span>
                          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${operational.tone}`}>{operational.label}</span>
                          {priorityReason ? (
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                              {priorityReason}
                            </span>
                          ) : null}
                          {priorityFamily ? (
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${priorityFamily.tone}`}>
                              {priorityFamily.label}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm font-medium text-slate-800">{row.target_role || "Puesto no definido"}</p>
                        <p className="mt-1 text-sm text-slate-600">{row.candidate_email || "Email no disponible"}</p>
                        <p className="mt-2 text-sm text-slate-700">{confidenceSummary}</p>
                        <p className="mt-1 text-xs font-medium text-slate-500">{progressLabel}</p>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        Última actividad
                        <div className="mt-1 font-semibold text-slate-700">{formatDate(row.last_activity_at || row.created_at)}</div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="text-xs uppercase tracking-wide text-slate-500">Experiencias verificadas</div>
                        <div className="mt-2 text-2xl font-semibold text-slate-900">{approved}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="text-xs uppercase tracking-wide text-slate-500">En proceso</div>
                        <div className="mt-2 text-2xl font-semibold text-slate-900">{inProcess}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="text-xs uppercase tracking-wide text-slate-500">Sin validar</div>
                        <div className="mt-2 text-2xl font-semibold text-slate-900">{unverified}</div>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setQuickViewRow(row);
                        }}
                        className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
                      >
                        Ver resumen
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setQuickViewRow(row);
                        }}
                        className="inline-flex rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-900 hover:bg-indigo-100"
                      >
                        Ver perfil completo
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleSetCandidateStage(row.id, stage === "saved" ? "none" : "saved");
                        }}
                        disabled={actionLoading === row.id}
                        className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                      >
                        {stage === "saved" ? "Quitar guardado" : "Guardar"}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleSetCandidateStage(row.id, stage === "preselected" ? "none" : "preselected");
                        }}
                        disabled={actionLoading === row.id}
                        className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                      >
                        {stage === "preselected" ? "Quitar preselección" : "Preseleccionar"}
                      </button>
                    </div>
                  </article>
                );
              })
            )}
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
              <p className="text-sm font-semibold text-slate-900">Accesos a perfiles disponibles</p>
              <p className="mt-1 text-sm text-slate-600">
                {availableProfileAccesses} disponibles ahora mismo.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {activeAccessCount} perfiles completos activos · {expiredAccessCount} accesos caducados listos para renovar.
              </p>
              {availableProfileAccesses <= 0 ? (
              <p className="mt-2 text-sm text-rose-700">No tienes accesos disponibles para abrir perfiles completos.</p>
              ) : null}
            </div>
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
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Compras recientes de accesos</p>
                  <p className="mt-1 text-xs text-slate-500">Histórico breve de compras puntuales registradas para esta empresa.</p>
                </div>
                <a href="/company/subscription" className="text-xs font-semibold text-slate-900 underline underline-offset-2">
                  Ver detalle
                </a>
              </div>
              <div className="mt-3 space-y-2">
                {recentAccessPurchases.length === 0 ? (
                  <p className="text-sm text-slate-600">Todavía no hay compras recientes visibles en este historial.</p>
                ) : (
                  recentAccessPurchases.map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{purchaseLabel(item.product_key)}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            +{Number(item.credits_granted || 0)} acceso{Number(item.credits_granted || 0) === 1 ? "" : "s"} · {formatDate(item.created_at)}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-slate-900">{eurFromCents(item.amount, item.currency)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <p className="text-sm font-semibold">Qué desbloquea el upgrade</p>
              <p className="mt-1 text-sm">
                Más capacidad de equipo, más ritmo operativo y un panel empresa que puede crecer contigo sin fricciones.
              </p>
              <a href="/company/subscription" className="mt-3 inline-flex rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800">
                Comprar accesos
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
              <p className="mt-2 text-xs text-slate-500">El nivel de confianza resume qué señales reales ya hacen ese perfil más sólido para una decisión de empresa.</p>
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
                  const fit = computeCandidateQuickFit(item);
                  const pipeline = resolveCandidatePipelineBucket(item);
                  return (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <button
                            type="button"
                            onClick={() => setQuickViewRow(item)}
                            className="text-left text-sm font-semibold text-slate-900 underline-offset-2 hover:underline"
                          >
                            {resolveCandidateDisplayName(item)}
                          </button>
                          <p className="mt-1 text-sm text-slate-600">{item.target_role || "Sin puesto definido"}</p>
                          <p className="mt-1 text-xs text-slate-500">Última actividad {formatDate(item.last_activity_at || item.created_at)}</p>
                          <p className="mt-1 text-xs text-slate-500">{fit.summary}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${fit.tone}`} title={fit.reasons.join(" · ")}>
                            {fit.label}
                          </span>
                          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badge.tone}`}>{badge.label}</span>
                          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${resolveCandidateOperationalStateMeta(item).tone}`}>
                            {resolveCandidateOperationalStateMeta(item).label}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                            {pipeline === "decision" ? "Decisión" : pipeline === "validation" ? "Validación" : "Revisión"}
                          </span>
                          {item.company_stage && item.company_stage !== "none" ? (
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                              item.company_stage === "preselected"
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 bg-slate-100 text-slate-700"
                            }`}>
                              {item.company_stage === "preselected" ? "Preseleccionado" : "Guardado"}
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => setQuickViewRow(item)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                          >
                            Vista rápida
                          </button>
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

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Perfiles ya desbloqueados</h2>
              <p className="mt-1 text-sm text-slate-600">Historial rápido para saber qué candidatos ya están abiertos y no consumirán otro acceso dentro de la ventana activa.</p>
            </div>
            <a href="/company/candidates" className="text-sm font-semibold text-slate-900 underline underline-offset-2">Abrir RRHH</a>
          </div>
          <div className="mt-4 space-y-3">
            {unlockedHistory.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                Todavía no has desbloqueado perfiles completos desde este panel.
              </div>
            ) : (
              unlockedHistory.map((item) => (
                <div key={`${item.id}-unlock`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{resolveCandidateDisplayName(item)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Desbloqueado el {formatDate(item.access_granted_at || item.last_activity_at || item.created_at)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">Consumo registrado: 1 acceso.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${String(item.access_status || "").toLowerCase() === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                        {String(item.access_status || "").toLowerCase() === "active" ? "Acceso vigente" : "Acceso caducado"}
                      </span>
                      {item.candidate_public_token ? (
                        <a
                          href={`/company/candidate/${encodeURIComponent(String(item.candidate_public_token))}?view=full`}
                          className="inline-flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                        >
                          Ver perfil completo
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Verificación documental empresa</h2>
              <p className="mt-1 text-sm text-slate-600">Lectura breve del estado actual, última entrega y prioridad de revisión aplicada.</p>
            </div>
            <a href="/company/profile" className="text-sm font-semibold text-slate-900 underline underline-offset-2">Abrir perfil</a>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${verificationStatusClass(verificationStatus)}`}>
                {verificationStatusLabelText}
              </span>
              {dashboard?.company_document_review_priority_label ? (
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  {dashboard.company_document_review_priority_label}
                </span>
              ) : null}
            </div>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p>{verificationStatusDetail || "Sube un documento oficial para iniciar la revisión documental."}</p>
              {dashboard?.company_document_last_submitted_at ? (
                <p>Documento recibido el {formatDate(dashboard.company_document_last_submitted_at)}</p>
              ) : null}
              {dashboard?.company_document_review_eta_label && (verificationStatus === "uploaded" || verificationStatus === "under_review") ? (
                <p>Tiempo estimado según plan: {dashboard.company_document_review_eta_label}</p>
              ) : null}
              {dashboard?.company_document_last_reviewed_at ? (
                <p>Última resolución registrada el {formatDate(dashboard.company_document_last_reviewed_at)}</p>
              ) : null}
            </div>
          </div>
        </article>
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
