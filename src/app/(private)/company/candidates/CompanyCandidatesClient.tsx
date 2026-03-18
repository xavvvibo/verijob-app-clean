"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CandidateQuickView from "@/components/company/CandidateQuickView";
import ProfileUnlockAction from "@/components/company/ProfileUnlockAction";
import {
  computeCandidateQuickFit,
  isCandidateVerified,
  resolveCandidateApproxLocation,
  resolveCandidateAvailableVerifications,
  resolveCandidateOperationalStateMeta,
  resolveCandidatePartialName,
  resolveCandidatePipelineBucket,
  resolveCandidateProfileReadiness,
  resolveCandidateSector,
  resolveCandidateTrustBand,
  resolveCandidateYearsExperience,
  type CompanyCandidateWorkspaceRow,
} from "@/lib/company/candidate-fit";

type ImportRow = CompanyCandidateWorkspaceRow & {
  id: string;
  candidate_email: string;
  parse_status?: string | null;
  invite_token?: string | null;
  access_granted_at?: string | null;
  access_source?: string | null;
};

type ImportsMeta = {
  available: boolean;
  warning_message?: string | null;
  migration_files?: string[];
};

type ImportPreview = {
  prefill?: {
    candidate_email?: string;
    candidate_name?: string;
    target_role?: string | null;
  };
  candidate_already_exists?: boolean;
  existing_candidate_name?: string | null;
  identity_name_mismatch?: boolean;
  parsing?: {
    warnings?: string[];
    extracted?: {
      languages?: string[];
      experiences?: any[];
      full_name?: string | null;
      email?: string | null;
    };
  };
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function statusMeta(status: string | null | undefined) {
  const key = String(status || "").toLowerCase();
  if (key === "ready") return { label: "Listo", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (key === "in_review") return { label: "En revisión", tone: "bg-blue-50 text-blue-700 border-blue-200" };
  return { label: "Nuevo", tone: "bg-slate-100 text-slate-700 border-slate-200" };
}

function accessMeta(status: string | null | undefined) {
  const key = String(status || "").toLowerCase();
  if (key === "active") return { label: "Perfil desbloqueado", tone: "border-emerald-200 bg-emerald-50 text-emerald-800" };
  if (key === "expired") return { label: "Acceso expirado", tone: "border-amber-200 bg-amber-50 text-amber-800" };
  return { label: "Perfil parcial disponible", tone: "border-slate-200 bg-slate-100 text-slate-700" };
}

function trustHelper(raw: unknown) {
  const score = Number(raw || 0);
  if (!Number.isFinite(score) || score <= 0) return "Todavía faltan señales suficientes para evaluar mejor el perfil.";
  if (score >= 70) return "Perfil con señales sólidas y buen nivel de validación.";
  if (score >= 40) return "Perfil con base razonable, pero aún puede reforzarse.";
  return "Perfil inicial; conviene revisar más señales antes de decidir.";
}

function actionButtonClass({
  primary = false,
  danger = false,
  disabled = false,
}: {
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  if (disabled) {
    return "inline-flex rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-400 cursor-not-allowed";
  }
  if (danger) {
    return "inline-flex rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100";
  }
  if (primary) {
    return "inline-flex rounded-xl border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-black";
  }
  return "inline-flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50";
}

export default function CompanyCandidatesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [imports, setImports] = useState<ImportRow[]>([]);
  const [importsMeta, setImportsMeta] = useState<ImportsMeta>({ available: true, migration_files: [] });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [quickViewRow, setQuickViewRow] = useState<ImportRow | null>(null);
  const [availableProfileAccesses, setAvailableProfileAccesses] = useState(0);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [pipelineFilter, setPipelineFilter] = useState(searchParams.get("pipeline") || "all");
  const [savedFilter, setSavedFilter] = useState(searchParams.get("saved") || "all");
  const [trustFilter, setTrustFilter] = useState(searchParams.get("trust") || "all");
  const [verificationFilter, setVerificationFilter] = useState(searchParams.get("verified") || "all");
  const [profileFilter, setProfileFilter] = useState(searchParams.get("profile") || "all");
  const [archivedFilter, setArchivedFilter] = useState(searchParams.get("archived") || "hide");
  const [sort, setSort] = useState(searchParams.get("sort") || "recent");
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    candidate_email: "",
    candidate_name: "",
    target_role: "",
    source_notes: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);

  const tokenDisabled = useMemo(() => token.trim().length === 0, [token]);
  const submitDisabled = useMemo(
    () => submitting || !importsMeta.available || !file || !String(form.candidate_email || "").trim(),
    [file, form.candidate_email, importsMeta.available, submitting]
  );
  const filteredImports = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = imports.filter((row) => {
      if (query) {
        const haystack = [resolveCandidatePartialName(row), row.candidate_email, row.target_role].join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (pipelineFilter !== "all" && resolveCandidatePipelineBucket(row) !== pipelineFilter) return false;
      if (savedFilter === "saved" && String(row.company_stage || "none").toLowerCase() !== "saved") return false;
      if (savedFilter === "preselected" && String(row.company_stage || "none").toLowerCase() !== "preselected") return false;
      if (trustFilter !== "all" && resolveCandidateTrustBand(row) !== trustFilter) return false;
      if (verificationFilter === "verified" && !isCandidateVerified(row)) return false;
      if (verificationFilter === "unverified" && isCandidateVerified(row)) return false;
      if (profileFilter !== "all" && resolveCandidateProfileReadiness(row) !== profileFilter) return false;
      if (archivedFilter === "hide" && String(row.company_stage || "").toLowerCase() === "archived") return false;
      if (archivedFilter === "only" && String(row.company_stage || "").toLowerCase() !== "archived") return false;
      return true;
    });

    rows.sort((a, b) => {
      if (sort === "trust") return Number(b.trust_score || 0) - Number(a.trust_score || 0);
      if (sort === "verified") return Number(b.approved_verifications || 0) - Number(a.approved_verifications || 0);
      return Date.parse(String(b.last_activity_at || b.created_at || 0)) - Date.parse(String(a.last_activity_at || a.created_at || 0));
    });
    return rows;
  }, [archivedFilter, imports, pipelineFilter, profileFilter, savedFilter, search, sort, trustFilter, verificationFilter]);

  const pipelineCounts = useMemo(
    () => ({
      review: imports.filter((row) => resolveCandidatePipelineBucket(row) === "review").length,
      validation: imports.filter((row) => resolveCandidatePipelineBucket(row) === "validation").length,
      decision: imports.filter((row) => resolveCandidatePipelineBucket(row) === "decision").length,
    }),
    [imports]
  );

  async function loadImports() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/company/candidate-imports", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.user_message || data?.details || data?.error || "No se pudo cargar la base de candidatos.");
      }
      setImports(Array.isArray(data?.imports) ? data.imports : []);
      setAvailableProfileAccesses(Number(data?.available_profile_accesses || 0));
      setImportsMeta(data?.imports_meta || { available: true, migration_files: [] });
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar la base de candidatos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadImports();
  }, []);

  useEffect(() => {
    const checkoutState = String(searchParams.get("checkout") || "");
    if (checkoutState === "cancel") {
      setCheckoutMessage("La compra no se completó. Puedes seguir revisando resúmenes parciales o intentarlo de nuevo.");
      return;
    }
    if (checkoutState !== "success") return;

    setCheckoutMessage("Pago recibido. Estamos actualizando tus accesos disponibles.");
    let cancelled = false;
    let attempts = 0;
    const interval = window.setInterval(async () => {
      if (cancelled) return;
      attempts += 1;
      await loadImports();
      if (attempts >= 4) {
        window.clearInterval(interval);
        if (!cancelled) {
          setCheckoutMessage("Compra completada. El saldo ya debería reflejarse en la base RRHH.");
        }
      }
    }, 2500);

    void loadImports();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [searchParams]);

  function openCandidate(event: React.FormEvent) {
    event.preventDefault();
    const value = token.trim();
    if (!value) {
      setError("Introduce un token válido para abrir el candidato.");
      return;
    }
    setError(null);
    router.push(`/company/candidate/${encodeURIComponent(value)}`);
  }

  async function submitImport(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      if (!file) throw new Error("Adjunta un CV en PDF, DOC o DOCX.");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("candidate_email", form.candidate_email);
      fd.append("candidate_name", form.candidate_name);
      fd.append("target_role", form.target_role);
      fd.append("source_notes", form.source_notes);

      const res = await fetch("/api/company/candidate-imports", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.user_message || data?.details || data?.error || "No se pudo crear la invitación.");
      }

      setForm({
        candidate_email: "",
        candidate_name: "",
        target_role: "",
        source_notes: "",
      });
      setFile(null);
      setImportPreview(null);
      setNotice(data?.user_message || "CV importado correctamente.");
      await loadImports();
    } catch (e: any) {
      setError(e?.message || "No se pudo crear la invitación.");
    } finally {
      setSubmitting(false);
    }
  }

  async function analyzeImport() {
    setPreviewing(true);
    setError(null);
    setNotice(null);

    try {
      if (!file) throw new Error("Adjunta un CV antes de analizarlo.");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("candidate_email", form.candidate_email);
      fd.append("candidate_name", form.candidate_name);
      fd.append("target_role", form.target_role);
      fd.append("source_notes", form.source_notes);
      fd.append("preview_only", "1");

      const res = await fetch("/api/company/candidate-imports", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.user_message || data?.details || data?.error || "No se pudo analizar el CV.");
      }

      setImportPreview(data);
      setForm((prev) => ({
        ...prev,
        candidate_email: data?.prefill?.candidate_email || prev.candidate_email,
        candidate_name: data?.prefill?.candidate_name || prev.candidate_name,
        target_role: data?.prefill?.target_role || prev.target_role,
      }));
      setNotice(data?.user_message || "CV analizado. Revisa el prefill antes de enviar.");
    } catch (e: any) {
      setError(e?.message || "No se pudo analizar el CV.");
    } finally {
      setPreviewing(false);
    }
  }

  async function updateCompanyStage(inviteId: string, stage: "saved" | "preselected" | "archived" | "none") {
    setActionId(inviteId);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/company/candidate-imports", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "set_stage",
          invite_id: inviteId,
          stage,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.user_message || data?.details || data?.error || "No se pudo actualizar el estado del candidato.");
      }
      setNotice(data?.user_message || "Estado actualizado.");
      setImports((prev) =>
        prev.map((row) =>
          row.id === inviteId
            ? {
                ...row,
                company_stage: stage,
                display_status: stage === "archived" ? "ready" : row.display_status,
                last_activity_at: data?.invite?.last_activity_at || new Date().toISOString(),
              }
            : row
        )
      );
      setQuickViewRow((prev) =>
        prev && prev.id === inviteId
          ? {
              ...prev,
              company_stage: stage,
              display_status: stage === "archived" ? "ready" : prev.display_status,
              last_activity_at: data?.invite?.last_activity_at || new Date().toISOString(),
            }
          : prev
      );
    } catch (e: any) {
      setError(e?.message || "No se pudo actualizar el estado del candidato.");
    } finally {
      setActionId(null);
    }
  }

  async function archiveImport(inviteId: string) {
    await updateCompanyStage(inviteId, "archived");
  }

  async function deleteImport(inviteId: string) {
    setActionId(inviteId);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/company/candidate-imports", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "delete_import",
          invite_id: inviteId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.user_message || data?.details || data?.error || "No se pudo eliminar la importación.");
      }
      setNotice(data?.user_message || "Importación eliminada.");
      setImports((prev) => prev.filter((row) => row.id !== inviteId));
      setQuickViewRow((prev) => (prev?.id === inviteId ? null : prev));
    } catch (e: any) {
      setError(e?.message || "No se pudo eliminar la importación.");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="space-y-6">
      {checkoutMessage ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {checkoutMessage}
        </section>
      ) : null}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Base RRHH</h1>
            <p className="mt-2 text-sm text-slate-600">
              Centro operativo para revisar pipeline, abrir resúmenes parciales y decidir cuándo merece la pena desbloquear un perfil completo.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Accesos disponibles</p>
            <p className="mt-1 font-semibold text-slate-900">{availableProfileAccesses}</p>
            {availableProfileAccesses <= 0 ? (
              <p className="mt-1 text-xs text-rose-700">Sin saldo para perfiles completos ahora mismo.</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Base de candidatos importados e invitados</h2>
            <p className="mt-1 text-sm text-slate-600">
              Base RRHH ligera para detectar encaje rápido, mover pipeline y decidir cuándo merece la pena acceder al perfil completo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/company/subscription"
              className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
            >
              Comprar accesos
            </a>
            <button
              type="button"
              onClick={() => void loadImports()}
              className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Actualizar
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setPipelineFilter("review")}
              className={`rounded-2xl border p-4 text-left ${pipelineFilter === "review" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900"}`}
            >
              <div className="text-xs uppercase tracking-wide">Por revisar</div>
              <div className="mt-2 text-2xl font-semibold">{pipelineCounts.review}</div>
            </button>
            <button
              type="button"
              onClick={() => setPipelineFilter("validation")}
              className={`rounded-2xl border p-4 text-left ${pipelineFilter === "validation" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900"}`}
            >
              <div className="text-xs uppercase tracking-wide">En validación</div>
              <div className="mt-2 text-2xl font-semibold">{pipelineCounts.validation}</div>
            </button>
            <button
              type="button"
              onClick={() => setPipelineFilter("decision")}
              className={`rounded-2xl border p-4 text-left ${pipelineFilter === "decision" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900"}`}
            >
              <div className="text-xs uppercase tracking-wide">Listos para decisión</div>
              <div className="mt-2 text-2xl font-semibold">{pipelineCounts.decision}</div>
            </button>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Buscar</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nombre, email o puesto"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ordenar por</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="recent">Más reciente</option>
                  <option value="trust">Mayor trust</option>
                  <option value="verified">Más verificado</option>
                </select>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { label: "Todo pipeline", active: pipelineFilter === "all", onClick: () => setPipelineFilter("all") },
                { label: "Guardados", active: savedFilter === "saved", onClick: () => setSavedFilter("saved") },
                { label: "Preseleccionados", active: savedFilter === "preselected", onClick: () => setSavedFilter("preselected") },
                { label: "Archivados", active: archivedFilter === "only", onClick: () => setArchivedFilter("only") },
                { label: "Ocultar archivados", active: archivedFilter === "hide", onClick: () => setArchivedFilter("hide") },
                { label: "Trust alto", active: trustFilter === "high", onClick: () => setTrustFilter("high") },
                { label: "Trust medio", active: trustFilter === "medium", onClick: () => setTrustFilter("medium") },
                { label: "Trust bajo", active: trustFilter === "low", onClick: () => setTrustFilter("low") },
                { label: "Verificados", active: verificationFilter === "verified", onClick: () => setVerificationFilter("verified") },
                { label: "No verificados", active: verificationFilter === "unverified", onClick: () => setVerificationFilter("unverified") },
                { label: "Perfil listo", active: profileFilter === "complete", onClick: () => setProfileFilter("complete") },
                { label: "Perfil incompleto", active: profileFilter === "incomplete", onClick: () => setProfileFilter("incomplete") },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={chip.onClick}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    chip.active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setPipelineFilter("all");
                  setSavedFilter("all");
                  setTrustFilter("all");
                  setVerificationFilter("all");
                  setProfileFilter("all");
                  setArchivedFilter("hide");
                  setSearch("");
                  setSort("recent");
                }}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <th className="py-3 pr-4">Candidato</th>
                <th className="py-3 pr-4">Sector</th>
                <th className="py-3 pr-4">Experiencia</th>
                <th className="py-3 pr-4">Ubicación</th>
                <th className="py-3 pr-4">Trust</th>
                <th className="py-3 pr-4">Verificaciones</th>
                <th className="py-3 pr-4">Acceso</th>
                <th className="py-3 pr-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    Cargando candidatos…
                  </td>
                </tr>
              ) : filteredImports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    {imports.length === 0
                      ? "Todavía no hay candidatos importados desde CV externo."
                      : "No hay candidatos que encajen con estos filtros ahora mismo."}
                  </td>
                </tr>
              ) : (
                filteredImports.map((row) => {
                  const status = statusMeta(row.display_status);
                  const access = accessMeta(row.access_status);
                  const operational = resolveCandidateOperationalStateMeta(row);
                  const fit = computeCandidateQuickFit(row);
                  const canOpenSnapshot = Boolean(row.linked_user_id && row.candidate_public_token);
                  const canOpenInvitation = Boolean(row.invite_token);
                  return (
                    <tr key={row.id}>
                      <td className="py-4 pr-4 align-top">
                        <button
                          type="button"
                          onClick={() => setQuickViewRow(row)}
                          className="font-semibold text-slate-900 underline-offset-2 hover:underline"
                        >
                          {resolveCandidatePartialName(row)}
                        </button>
                        <div className="mt-1">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${fit.tone}`} title={fit.reasons.join(" · ")}>
                            {fit.label}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{fit.summary}</div>
                        <div className="mt-1 text-xs text-slate-500">{operational.detail}</div>
                        {row.candidate_already_exists ? (
                          <div className="mt-1 text-xs text-violet-700">Candidato existente detectado por email único. La importación se ha dejado en staging.</div>
                        ) : null}
                        {Number((row as any).import_attempts || 0) > 1 ? (
                          <div className="mt-1 text-xs text-slate-500">{Number((row as any).import_attempts)} importaciones agrupadas en esta misma identidad.</div>
                        ) : null}
                      </td>
                      <td className="py-4 pr-4 align-top text-slate-700">{resolveCandidateSector(row)}</td>
                      <td className="py-4 pr-4 align-top text-slate-700">{resolveCandidateYearsExperience(row)}</td>
                      <td className="py-4 pr-4 align-top text-slate-700">{resolveCandidateApproxLocation(row)}</td>
                      <td className="py-4 pr-4 align-top text-slate-700">
                        <div className="font-semibold text-slate-900">{row.trust_score ?? "—"}</div>
                        <div className="mt-1 text-xs text-slate-500">{trustHelper(row.trust_score)}</div>
                      </td>
                      <td className="py-4 pr-4 align-top text-slate-700">{resolveCandidateAvailableVerifications(row)}</td>
                      <td className="py-4 pr-4 align-top">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${access.tone}`}>
                          {access.label}
                        </span>
                        <div className="mt-2">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${operational.tone}`}>
                            {operational.label}
                          </span>
                        </div>
                        <div className="mt-2">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${status.tone}`}>
                            {status.label}
                          </span>
                        </div>
                        {row.company_stage && row.company_stage !== "none" ? (
                          <div className="mt-2">
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                              row.company_stage === "preselected"
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 bg-slate-100 text-slate-700"
                            }`}>
                              {row.company_stage === "preselected" ? "Preseleccionado" : "Guardado"}
                            </span>
                          </div>
                        ) : null}
                        {row.access_status === "active" && row.access_expires_at ? (
                          <div className="mt-1 text-xs text-slate-500">Disponible hasta {formatDate(row.access_expires_at)}</div>
                        ) : null}
                        {row.access_status === "active" && row.access_granted_at ? (
                          <div className="mt-1 text-xs text-slate-500">Desbloqueado el {formatDate(row.access_granted_at)}</div>
                        ) : null}
                        {row.access_status === "expired" && row.access_expires_at ? (
                          <div className="mt-1 text-xs text-slate-500">Caducó el {formatDate(row.access_expires_at)}</div>
                        ) : null}
                        {row.access_status === "never" ? (
                          <div className="mt-1 text-xs text-slate-500">El candidato sigue en perfil parcial. Desbloquéalo para ver el perfil completo.</div>
                        ) : null}
                      </td>
                      <td className="py-4 pr-4 align-top">
                        <div className="flex flex-wrap gap-2">
                          {canOpenSnapshot ? (
                            <a href={`/company/candidate/${encodeURIComponent(String(row.candidate_public_token))}`} className={actionButtonClass({})}>
                              Ver resumen
                            </a>
                          ) : (
                            <span className={actionButtonClass({ disabled: true })}>Ver resumen</span>
                          )}
                          {canOpenInvitation ? (
                            <a href={`/company-candidate-import/${encodeURIComponent(String(row.invite_token))}`} className={actionButtonClass({})}>
                              Ver invitación
                            </a>
                          ) : (
                            <span className={actionButtonClass({ disabled: true })}>Ver invitación</span>
                          )}
                          {canOpenSnapshot ? (
                            <ProfileUnlockAction
                              href={`/company/candidate/${encodeURIComponent(String(row.candidate_public_token))}?view=full`}
                              availableAccesses={availableProfileAccesses}
                              alreadyUnlocked={row.access_status === "active"}
                              primaryLabel="Acceder al perfil"
                            />
                          ) : (
                            <span className={actionButtonClass({ primary: true, disabled: true })}>Acceder al perfil</span>
                          )}
                          <button
                            type="button"
                            onClick={() => updateCompanyStage(row.id, row.company_stage === "saved" ? "none" : "saved")}
                            disabled={actionId === row.id}
                            className={`${actionButtonClass({})} disabled:opacity-60`}
                          >
                            {actionId === row.id && row.company_stage !== "saved"
                              ? "Guardando…"
                              : row.company_stage === "saved"
                                ? "Quitar guardado"
                                : "Guardar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateCompanyStage(row.id, row.company_stage === "preselected" ? "none" : "preselected")}
                            disabled={actionId === row.id}
                            className={`${actionButtonClass({ primary: true })} disabled:opacity-60`}
                          >
                            {actionId === row.id && row.company_stage !== "preselected"
                              ? "Actualizando…"
                              : row.company_stage === "preselected"
                                ? "Quitar preselección"
                                : "Preseleccionar"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void (row.company_stage === "archived" ? updateCompanyStage(row.id, "none") : archiveImport(row.id))
                            }
                            disabled={actionId === row.id}
                            className={`${actionButtonClass({})} disabled:opacity-60`}
                          >
                            {actionId === row.id
                              ? row.company_stage === "archived"
                                ? "Restaurando…"
                                : "Archivando…"
                              : row.company_stage === "archived"
                                ? "Restaurar"
                                : "Archivar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteImport(row.id)}
                            disabled={actionId === row.id}
                            className={`${actionButtonClass({ danger: true })} disabled:opacity-60`}
                          >
                            {actionId === row.id ? "Eliminando…" : "Eliminar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Quick actions</h2>
              <p className="mt-1 text-sm text-slate-600">
                Usa estas acciones para incorporar candidatos externos o abrir directamente un perfil compartido por token.
              </p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              Acciones auxiliares
            </span>
          </div>

          {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
          {notice ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div> : null}

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Importar CV externo</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Sube un CV recibido fuera de VERIJOB y genera una invitación trazable al candidato.
                  </p>
                </div>
                <details className="text-xs text-slate-500">
                  <summary className="cursor-pointer list-none font-semibold text-slate-700">Ayuda rápida</summary>
                  <div className="mt-2 max-w-sm rounded-xl border border-slate-200 bg-white p-3 text-slate-600">
                    VERIJOB registra la aceptación legal del candidato antes de activar su perfil pre-rellenado y mostrarlo en esta base RRHH.
                  </div>
                </details>
              </div>

              {!importsMeta.available ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-semibold">Módulo pendiente de activación en base de datos</p>
                  <p className="mt-1">{importsMeta.warning_message}</p>
                  {importsMeta.migration_files?.length ? (
                    <p className="mt-2 text-xs text-amber-800">SQL requerido: {importsMeta.migration_files.join(", ")}</p>
                  ) : null}
                </div>
              ) : null}

              <form onSubmit={submitImport} className="mt-4 space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email del candidato</span>
                    <input
                      type="email"
                      value={form.candidate_email}
                      onChange={(e) => setForm((prev) => ({ ...prev, candidate_email: e.target.value }))}
                      placeholder="candidato@email.com"
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre</span>
                    <input
                      value={form.candidate_name}
                      onChange={(e) => setForm((prev) => ({ ...prev, candidate_name: e.target.value }))}
                      placeholder="Opcional si el CV ya lo trae"
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Puesto</span>
                    <input
                      value={form.target_role}
                      onChange={(e) => setForm((prev) => ({ ...prev, target_role: e.target.value }))}
                      placeholder="Opcional"
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">CV</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => {
                        setFile(e.target.files?.[0] || null);
                        setImportPreview(null);
                      }}
                      className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nota interna</span>
                  <textarea
                    value={form.source_notes}
                    onChange={(e) => setForm((prev) => ({ ...prev, source_notes: e.target.value }))}
                    placeholder="Ej. CV recibido en entrevista presencial para responsable de turno."
                    rows={2}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </label>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void analyzeImport()}
                    disabled={previewing || submitting || !importsMeta.available || !file}
                    className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {previewing ? "Analizando CV…" : "Analizar y pre-rellenar"}
                  </button>
                  <button
                    type="submit"
                    disabled={submitDisabled}
                    className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                  >
                    {submitting ? "Importando CV…" : "Subir CV e invitar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setForm({ candidate_email: "", candidate_name: "", target_role: "", source_notes: "" });
                      setFile(null);
                      setImportPreview(null);
                      setError(null);
                      setNotice(null);
                    }}
                    className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    Limpiar
                  </button>
                </div>
              </form>

              {importPreview ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">Prefill detectado desde CV</h4>
                      <p className="mt-1 text-xs text-slate-600">
                        Revisa estos datos antes del envío. Si el email ya existe, el perfil no se sobrescribirá y la importación quedará en staging.
                      </p>
                    </div>
                    {importPreview.candidate_already_exists ? (
                      <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                        Email ya existente
                      </span>
                    ) : null}
                  </div>
                  <dl className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</dt>
                      <dd className="mt-1">{form.candidate_email || "No detectado"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre</dt>
                      <dd className="mt-1">{form.candidate_name || "No detectado"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Puesto</dt>
                      <dd className="mt-1">{form.target_role || "No detectado"}</dd>
                    </div>
                  </dl>
                  {importPreview.candidate_already_exists ? (
                    <p className="mt-3 text-xs text-violet-700">
                      El email ya existe en VERIJOB.
                      {importPreview.existing_candidate_name ? ` Perfil actual: ${importPreview.existing_candidate_name}.` : ""}
                    </p>
                  ) : null}
                  {importPreview.identity_name_mismatch ? (
                    <p className="mt-2 text-xs text-amber-700">
                      El nombre detectado no coincide razonablemente con el ya asociado a ese email. Revísalo antes de continuar.
                    </p>
                  ) : null}
                  {Array.isArray(importPreview.parsing?.extracted?.languages) && importPreview.parsing?.extracted?.languages?.length ? (
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Idiomas detectados</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {importPreview.parsing?.extracted?.languages?.map((language) => (
                          <span key={language} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {language}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Abrir por token</p>
                <p className="mt-2 text-sm text-slate-600">
                  Utilidad rápida para abrir un candidato compartido fuera de la base actual.
                </p>
                <form onSubmit={openCandidate} className="mt-3">
                  <input
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Pega aquí el token recibido"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <button
                    type="submit"
                    disabled={tokenDisabled}
                    className="mt-3 inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Abrir perfil candidato
                  </button>
                </form>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">Ayuda contextual</p>
                <p className="mt-2">
                  La base RRHH es el centro de trabajo. Importa un CV externo cuando el candidato aún no está en VERIJOB y usa el token solo como acceso rápido puntual.
                </p>
              </div>
            </div>
          </div>
        </article>
      </section>

      <CandidateQuickView
        row={quickViewRow}
        open={Boolean(quickViewRow)}
        onClose={() => setQuickViewRow(null)}
        onSetStage={updateCompanyStage}
        actionLoading={actionId}
        availableProfileAccesses={availableProfileAccesses}
      />
    </div>
  );
}
