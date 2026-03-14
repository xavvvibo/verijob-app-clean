"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ImportRow = {
  id: string;
  candidate_email: string;
  candidate_name_raw?: string | null;
  linked_profile_name?: string | null;
  target_role?: string | null;
  created_at?: string | null;
  display_status?: string | null;
  parse_status?: string | null;
  trust_score?: number | null;
  total_verifications?: number | null;
  approved_verifications?: number | null;
  invite_token?: string | null;
  candidate_public_token?: string | null;
  linked_user_id?: string | null;
  candidate_already_exists?: boolean | null;
  company_stage?: "none" | "saved" | "preselected" | string | null;
  last_activity_at?: string | null;
  access_status?: "active" | "expired" | "never" | string | null;
  access_granted_at?: string | null;
  access_expires_at?: string | null;
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
  if (key === "active") return { label: "Acceso activo", tone: "border-emerald-200 bg-emerald-50 text-emerald-800" };
  if (key === "expired") return { label: "Acceso expirado", tone: "border-amber-200 bg-amber-50 text-amber-800" };
  return { label: "Sin acceso", tone: "border-slate-200 bg-slate-100 text-slate-700" };
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
  const [token, setToken] = useState("");
  const [imports, setImports] = useState<ImportRow[]>([]);
  const [importsMeta, setImportsMeta] = useState<ImportsMeta>({ available: true, migration_files: [] });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({
    candidate_email: "",
    candidate_name: "",
    target_role: "",
    source_notes: "",
  });
  const [file, setFile] = useState<File | null>(null);

  const tokenDisabled = useMemo(() => token.trim().length === 0, [token]);

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
    } catch (e: any) {
      setError(e?.message || "No se pudo actualizar el estado del candidato.");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="space-y-6">
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
              Sigue el estado del flujo desde la subida del CV hasta la creación del perfil y la verificación.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadImports()}
            className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            Actualizar
          </button>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <th className="py-3 pr-4">Nombre</th>
                <th className="py-3 pr-4">Email</th>
                <th className="py-3 pr-4">Puesto</th>
                <th className="py-3 pr-4">Estado</th>
                <th className="py-3 pr-4">Acceso</th>
                <th className="py-3 pr-4">Última actividad</th>
                <th className="py-3 pr-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Cargando candidatos…
                  </td>
                </tr>
              ) : imports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Todavía no hay candidatos importados desde CV externo.
                  </td>
                </tr>
              ) : (
                imports.map((row) => {
                  const status = statusMeta(row.display_status);
                  const access = accessMeta(row.access_status);
                  const canOpenSnapshot = Boolean(row.linked_user_id && row.candidate_public_token);
                  const canOpenInvitation = Boolean(row.invite_token);
                  const accessActionLabel =
                    row.access_status === "active"
                      ? "Ver CV completo"
                      : row.access_status === "expired"
                        ? "Volver a desbloquear"
                        : "Desbloquear perfil";
                  return (
                    <tr key={row.id}>
                      <td className="py-4 pr-4 align-top">
                        <div className="font-semibold text-slate-900">{row.linked_profile_name || row.candidate_name_raw || "Candidato importado"}</div>
                        {row.trust_score != null ? <div className="mt-1 text-xs text-slate-500">Trust score: {row.trust_score}</div> : null}
                        {row.candidate_already_exists ? (
                          <div className="mt-1 text-xs text-violet-700">Ya existía en VERIJOB antes de esta importación.</div>
                        ) : null}
                      </td>
                      <td className="py-4 pr-4 align-top text-slate-700">{row.candidate_email}</td>
                      <td className="py-4 pr-4 align-top text-slate-700">{row.target_role || "No indicado"}</td>
                      <td className="py-4 pr-4 align-top">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${status.tone}`}>
                          {status.label}
                        </span>
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
                        {row.total_verifications ? (
                          <div className="mt-1 text-xs text-slate-500">
                            {row.approved_verifications || 0} aprobadas de {row.total_verifications}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-4 pr-4 align-top">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${access.tone}`}>
                          {access.label}
                        </span>
                        {row.access_status === "active" && row.access_expires_at ? (
                          <div className="mt-1 text-xs text-slate-500">Disponible hasta {formatDate(row.access_expires_at)}</div>
                        ) : null}
                        {row.access_status === "expired" && row.access_expires_at ? (
                          <div className="mt-1 text-xs text-slate-500">Caducó el {formatDate(row.access_expires_at)}</div>
                        ) : null}
                        {row.access_status === "never" ? (
                          <div className="mt-1 text-xs text-slate-500">Todavía no has desbloqueado el perfil completo de este candidato.</div>
                        ) : null}
                      </td>
                      <td className="py-4 pr-4 align-top text-slate-700">{formatDate(row.last_activity_at || row.created_at)}</td>
                      <td className="py-4 pr-4 align-top">
                        <div className="flex flex-wrap gap-2">
                          {canOpenSnapshot ? (
                            <a
                              href={`/company/candidate/${encodeURIComponent(row.candidate_public_token)}`}
                              className={actionButtonClass({})}
                            >
                              Ver resumen
                            </a>
                          ) : (
                            <span className={actionButtonClass({ disabled: true })}>Ver resumen</span>
                          )}
                          {canOpenInvitation ? (
                            <a
                              href={`/company-candidate-import/${encodeURIComponent(String(row.invite_token))}`}
                              className={actionButtonClass({})}
                            >
                              Ver invitación
                            </a>
                          ) : (
                            <span className={actionButtonClass({ disabled: true })}>Ver invitación</span>
                          )}
                          {canOpenSnapshot ? (
                            <a
                              href={`/company/candidate/${encodeURIComponent(row.candidate_public_token)}?view=full`}
                              className={actionButtonClass({ primary: true })}
                            >
                              {accessActionLabel}
                            </a>
                          ) : (
                            <span className={actionButtonClass({ primary: true, disabled: true })}>Desbloquear perfil</span>
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
                          <span
                            className={actionButtonClass({ disabled: true })}
                            title="La acción de archivado todavía no está disponible en este flujo."
                          >
                            Archivar
                          </span>
                          <span
                            className={actionButtonClass({ danger: true, disabled: true })}
                            title="La eliminación todavía no está disponible en este flujo."
                          >
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
    </div>
  );
}
