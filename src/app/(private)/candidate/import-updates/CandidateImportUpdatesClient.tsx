"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Suggestion = {
  id: string;
  kind: "duplicate" | "new" | "update";
  reason: string;
  status: "pending" | "accepted" | "dismissed";
  extracted_experience?: {
    company_name?: string | null;
    role_title?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    description?: string | null;
  };
  matched_existing?: {
    id?: string | null;
    company_name?: string | null;
    role_title?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    description?: string | null;
  } | null;
};

type UpdateEntry = {
  invite_id: string;
  company_name?: string | null;
  imported_at?: string | null;
  candidate_identity?: {
    display_name?: string | null;
    email?: string | null;
    reliable_name?: string | null;
    existing_candidate?: boolean | null;
  };
  profile_proposal?: {
    merged_languages?: string[];
    new_languages?: string[];
    languages_applied_at?: string | null;
    full_name?: string | null;
    full_name_source?: string | null;
  };
  experience_suggestions?: Suggestion[];
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

function SuggestionCard({
  inviteId,
  suggestion,
  onAction,
  loadingId,
}: {
  inviteId: string;
  suggestion: Suggestion;
  onAction: (inviteId: string, suggestionId: string, action: "accept" | "dismiss") => Promise<void>;
  loadingId: string | null;
}) {
  const busy = loadingId === suggestion.id;
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            {suggestion.extracted_experience?.role_title || "Experiencia"} · {suggestion.extracted_experience?.company_name || "Empresa"}
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            {suggestion.extracted_experience?.start_date || "Fecha sin indicar"} → {suggestion.extracted_experience?.end_date || "Actualidad / sin indicar"}
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
          {suggestion.kind === "new" ? "Nueva" : suggestion.kind === "update" ? "Posible actualización" : "Duplicada"}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-600">{suggestion.reason}</p>
      {suggestion.matched_existing ? (
        <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          <p className="font-semibold">Experiencia actual relacionada</p>
          <p className="mt-1">
            {suggestion.matched_existing.role_title || "Experiencia"} · {suggestion.matched_existing.company_name || "Empresa"}
          </p>
        </div>
      ) : null}
      {suggestion.status === "pending" && suggestion.kind !== "duplicate" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onAction(inviteId, suggestion.id, "accept")}
            className="inline-flex rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-black disabled:opacity-60"
          >
            {busy ? "Aplicando…" : suggestion.kind === "new" ? "Añadir al perfil" : "Aplicar actualización"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onAction(inviteId, suggestion.id, "dismiss")}
            className="inline-flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
          >
            Descartar
          </button>
        </div>
      ) : (
        <p className="mt-4 text-xs font-semibold text-slate-500">
          {suggestion.status === "accepted" ? "Cambio aplicado" : suggestion.status === "dismissed" ? "Sugerencia descartada" : "Sin acción requerida"}
        </p>
      )}
    </article>
  );
}

export default function CandidateImportUpdatesClient() {
  const [updates, setUpdates] = useState<UpdateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [proposalLoadingId, setProposalLoadingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/candidate/import-updates", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.details || data?.error || "No se pudieron cargar las actualizaciones.");
      setUpdates(Array.isArray(data?.updates) ? data.updates : []);
    } catch (e: any) {
      setError(e?.message || "No se pudieron cargar las actualizaciones.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleAction(inviteId: string, suggestionId: string, action: "accept" | "dismiss") {
    setLoadingId(suggestionId);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/candidate/import-updates", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invite_id: inviteId, suggestion_id: suggestionId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.details || data?.error || "No se pudo actualizar la sugerencia.");
      setNotice(action === "accept" ? "Cambio aplicado al perfil." : "Sugerencia descartada.");
      await load();
    } catch (e: any) {
      setError(e?.message || "No se pudo actualizar la sugerencia.");
    } finally {
      setLoadingId(null);
    }
  }

  async function applyLanguages(inviteId: string) {
    setProposalLoadingId(inviteId);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/candidate/import-updates", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invite_id: inviteId, proposal_action: "apply_languages" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.details || data?.error || "No se pudieron aplicar los idiomas detectados.");
      setNotice("Idiomas incorporados al perfil sin borrar los que ya tenías.");
      await load();
    } catch (e: any) {
      setError(e?.message || "No se pudieron aplicar los idiomas detectados.");
    } finally {
      setProposalLoadingId(null);
    }
  }

  const pendingCount = updates.reduce((acc, entry) => {
    const suggestions = Array.isArray(entry.experience_suggestions) ? entry.experience_suggestions : [];
    return acc + suggestions.filter((item) => item.status === "pending" && item.kind !== "duplicate").length;
  }, 0);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Actualizaciones de CV detectadas</h1>
        <p className="mt-2 text-sm text-slate-600">
          Una empresa ha incorporado una nueva versión de tu CV. Aquí puedes revisar diferencias, aceptar cambios útiles y evitar duplicados silenciosos.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
            Pendientes: {pendingCount}
          </span>
          <Link href="/candidate/experience" className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">
            Revisar y actualizar mi perfil
          </Link>
        </div>
        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
        {notice ? <p className="mt-4 text-sm text-emerald-700">{notice}</p> : null}
      </section>

      {loading ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm text-sm text-slate-600">
          Cargando actualizaciones…
        </section>
      ) : updates.length === 0 ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm text-sm text-slate-600">
          No hay cambios pendientes procedentes de CV importados por empresa.
        </section>
      ) : (
        updates.map((entry) => {
          const suggestions = Array.isArray(entry.experience_suggestions) ? entry.experience_suggestions : [];
          const existing = suggestions.filter((item) => item.kind === "duplicate");
          const fresh = suggestions.filter((item) => item.kind === "new");
          const updatesOnly = suggestions.filter((item) => item.kind === "update");
          return (
            <section key={entry.invite_id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{entry.company_name || "Empresa"}</h2>
                  <p className="mt-1 text-sm text-slate-600">Importado el {formatDate(entry.imported_at)}</p>
                  {entry.candidate_identity?.existing_candidate ? (
                    <p className="mt-1 text-xs text-violet-700">
                      Email ya existente detectado. Esta importación se ha mantenido en staging y agrupada sobre tu identidad actual.
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Nuevas: {fresh.length}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Actualizaciones: {updatesOnly.length}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Duplicadas: {existing.length}</span>
                </div>
              </div>

              {Array.isArray(entry.profile_proposal?.merged_languages) && entry.profile_proposal?.merged_languages.length ? (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-emerald-950">Idiomas detectados en la propuesta</h3>
                      <p className="mt-1 text-sm text-emerald-900">
                        Los idiomas actuales se conservan. Solo se añaden los nuevos detectados con suficiente claridad.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void applyLanguages(entry.invite_id)}
                      disabled={proposalLoadingId === entry.invite_id || Boolean(entry.profile_proposal?.languages_applied_at)}
                      className="inline-flex rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-black disabled:opacity-60"
                    >
                      {entry.profile_proposal?.languages_applied_at
                        ? "Idiomas ya aplicados"
                        : proposalLoadingId === entry.invite_id
                          ? "Aplicando…"
                          : "Aplicar idiomas"}
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {entry.profile_proposal.merged_languages?.map((language) => (
                      <span key={`${entry.invite_id}-${language}`} className="rounded-full border border-emerald-300 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-900">
                        {language}
                      </span>
                    ))}
                  </div>
                  {Array.isArray(entry.profile_proposal?.new_languages) && entry.profile_proposal.new_languages.length ? (
                    <p className="mt-3 text-xs text-emerald-900">
                      Nuevos detectados: {entry.profile_proposal.new_languages.join(", ")}.
                    </p>
                  ) : (
                    <p className="mt-3 text-xs text-emerald-900">No se han detectado idiomas nuevos respecto a tu perfil actual.</p>
                  )}
                </div>
              ) : null}

              {fresh.length ? (
                <div className="mt-5">
                  <h3 className="text-sm font-semibold text-slate-900">Experiencias nuevas detectadas</h3>
                  <div className="mt-3 grid gap-3">{fresh.map((item) => <SuggestionCard key={item.id} inviteId={entry.invite_id} suggestion={item} onAction={handleAction} loadingId={loadingId} />)}</div>
                </div>
              ) : null}

              {updatesOnly.length ? (
                <div className="mt-5">
                  <h3 className="text-sm font-semibold text-slate-900">Posibles actualizaciones</h3>
                  <div className="mt-3 grid gap-3">{updatesOnly.map((item) => <SuggestionCard key={item.id} inviteId={entry.invite_id} suggestion={item} onAction={handleAction} loadingId={loadingId} />)}</div>
                </div>
              ) : null}

              {existing.length ? (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Experiencias ya existentes</h3>
                  <ul className="mt-2 space-y-2 text-sm text-slate-600">
                    {existing.map((item) => (
                      <li key={item.id}>
                        {item.extracted_experience?.role_title || "Experiencia"} · {item.extracted_experience?.company_name || "Empresa"}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          );
        })
      )}
    </div>
  );
}
