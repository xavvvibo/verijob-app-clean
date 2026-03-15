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

const HOW_TO_USE = [
  {
    title: "Importa un CV recibido fuera de VERIJOB",
    description: "Sube el CV, indica el email del candidato y genera una invitación trazable.",
  },
  {
    title: "El candidato acepta expresamente",
    description: "VERIJOB registra la aceptación legal antes de desbloquear el perfil pre-rellenado.",
  },
  {
    title: "Sigue el estado del proceso",
    description: "Controla quién está pendiente, quién ya creó perfil y quién está verificando su historial.",
  },
];

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
  if (key === "verified") return { label: "Verificado", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (key === "verifying") return { label: "Verificando", tone: "bg-blue-50 text-blue-700 border-blue-200" };
  if (key === "profile_created") return { label: "Perfil creado", tone: "bg-indigo-50 text-indigo-700 border-indigo-200" };
  if (key === "existing_candidate") return { label: "Candidato existente", tone: "bg-violet-50 text-violet-700 border-violet-200" };
  if (key === "acceptance_pending") return { label: "Pendiente de aceptación", tone: "bg-amber-50 text-amber-800 border-amber-200" };
  if (key === "parse_failed") return { label: "Importación parcial", tone: "bg-rose-50 text-rose-700 border-rose-200" };
  if (key === "processing") return { label: "Importando", tone: "bg-slate-100 text-slate-700 border-slate-200" };
  return { label: "Subido", tone: "bg-slate-100 text-slate-700 border-slate-200" };
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
  const [sort, setSort] = useState(searchParams.get("sort") || "recent");
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    candidate_email: "",
    candidate_name: "",
    target_role: "",
    source_notes: "",
  });
  const [file, setFile] = useState<File | null>(null);

  const tokenDisabled = useMemo(() => token.trim().length === 0, [token]);
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
      return true;
    });

    rows.sort((a, b) => {
      if (sort === "trust") return Number(b.trust_score || 0) - Number(a.trust_score || 0);
      if (sort === "verified") return Number(b.approved_verifications || 0) - Number(a.approved_verifications || 0);
      return Date.parse(String(b.last_activity_at || b.created_at || 0)) - Date.parse(String(a.last_activity_at || a.created_at || 0));
    });
    return rows;
  }, [imports, pipelineFilter, profileFilter, savedFilter, search, sort, trustFilter, verificationFilter]);

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
      setNotice(data?.user_message || "CV importado correctamente.");
      await loadImports();
    } catch (e: any) {
      setError(e?.message || "No se pudo crear la invitación.");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateCompanyStage(inviteId: string, stage: "saved" | "preselected" | "none") {
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

  return (
    <div className="space-y-6">
      {checkoutMessage ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {checkoutMessage}
        </section>
      ) : null}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Candidatos</h1>
        <p className="mt-2 text-sm text-slate-600">
          Gestiona candidatos que llegan directamente a VERIJOB y también CV recibidos fuera de plataforma con trazabilidad de aceptación.
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Importar CV externo e invitar candidato</h2>
              <p className="mt-2 text-sm text-slate-600">
                ¿Has recibido un CV fuera de VERIJOB? Súbelo aquí e invita al candidato a verificar su perfil.
              </p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              Flujo empresa → candidato
            </span>
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

          <form onSubmit={submitImport} className="mt-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-slate-900">Email del candidato</span>
                <input
                  type="email"
                  value={form.candidate_email}
                  onChange={(e) => setForm((prev) => ({ ...prev, candidate_email: e.target.value }))}
                  placeholder="candidato@email.com"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-900">Nombre del candidato</span>
                <input
                  value={form.candidate_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, candidate_name: e.target.value }))}
                  placeholder="Opcional si el CV ya lo trae"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-slate-900">Puesto al que aplica</span>
                <input
                  value={form.target_role}
                  onChange={(e) => setForm((prev) => ({ ...prev, target_role: e.target.value }))}
                  placeholder="Opcional"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-900">CV del candidato</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-semibold text-slate-900">Contexto o nota interna</span>
              <textarea
                value={form.source_notes}
                onChange={(e) => setForm((prev) => ({ ...prev, source_notes: e.target.value }))}
                placeholder="Ej. CV recibido en entrevista presencial para responsable de turno."
                rows={3}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </label>

            {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
            {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div> : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={submitting || !importsMeta.available}
                className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
              >
                {submitting ? "Importando CV…" : "Subir CV e invitar candidato"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setForm({ candidate_email: "", candidate_name: "", target_role: "", source_notes: "" });
                  setFile(null);
                  setError(null);
                  setNotice(null);
                }}
                className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                Limpiar
              </button>
            </div>
          </form>
        </article>

        <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-sm font-semibold text-slate-900">Cómo usar esta sección</h2>
          <ul className="mt-3 space-y-3">
            {HOW_TO_USE.map((item) => (
              <li key={item.title}>
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="text-sm text-slate-600">{item.description}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Acceso directo</p>
            <form onSubmit={openCandidate} className="mt-3">
              <label className="block text-sm font-semibold text-slate-900">Abrir candidato por token</label>
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Pega aquí el token recibido"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
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
        </aside>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Base de candidatos importados e invitados</h2>
            <p className="mt-1 text-sm text-slate-600">
              Base RRHH ligera para detectar encaje rápido, mover pipeline y decidir cuándo merece la pena acceder al perfil completo.
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              Accesos a perfiles disponibles: {availableProfileAccesses}
            </p>
            {availableProfileAccesses <= 0 ? (
              <p className="mt-1 text-sm text-rose-700">No tienes accesos disponibles para ver perfiles completos.</p>
            ) : null}
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
                          <div className="mt-1 text-xs text-violet-700">Ya existía en VERIJOB antes de esta importación.</div>
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
                          <span className={actionButtonClass({ disabled: true })} title="La acción de archivado todavía no está disponible en este flujo.">
                            Archivar
                          </span>
                          <span className={actionButtonClass({ danger: true, disabled: true })} title="La eliminación todavía no está disponible en este flujo.">
                            Eliminar
                          </span>
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
