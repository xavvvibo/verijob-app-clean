"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { buildVerificationPayload } from "@/lib/fix-verification-payload";
import { parseExperienceDateInput, toExperienceInputValue } from "@/lib/candidate/experience-date-input";

const EXPERIENCE_CREATED_EVENT = "candidate:experience-created";

type ExperienceStatus =
  | "Sin verificar"
  | "Validación solicitada"
  | "En revisión"
  | "Verificada"
  | "Revocada";

type Row = {
  id: string;
  employment_record_id?: string | null;
  role_title: string | null;
  company_name: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  status: ExperienceStatus;
  last_action: string;
  source_label?: string | null;
  verification_labels?: string[] | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type VerifyState = "idle" | "loading" | "success" | "error";

function formatExperienceDate(value: string | null, { isEnd = false }: { isEnd?: boolean } = {}) {
  const raw = String(value || "").trim();
  if (!raw) return isEnd ? "Actualidad" : "Fecha no indicada";
  const lower = raw.toLowerCase();
  if (lower.includes("actual") || lower.includes("present")) return "Actualidad";

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(d);
    }
  }

  const ym = raw.match(/^(\d{4})-(\d{2})$/);
  if (ym) {
    const d = new Date(`${ym[1]}-${ym[2]}-01T00:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(d);
    }
  }

  return raw;
}

function statusClasses(status: ExperienceStatus) {
  if (status === "Verificada") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "Revocada") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "En revisión") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "Validación solicitada") return "border-sky-200 bg-sky-50 text-sky-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function ExperienceListClient({ initialRows }: { initialRows: Row[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [expandedId, setExpandedId] = useState<string | null>(initialRows[0]?.id || null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingCurrentById, setEditingCurrentById] = useState<Record<string, boolean>>({});
  const [verificationEmailById, setVerificationEmailById] = useState<Record<string, string>>({});
  const [verifyStateById, setVerifyStateById] = useState<Record<string, VerifyState>>({});
  const [verifyMessageById, setVerifyMessageById] = useState<Record<string, string | null>>({});

  useEffect(() => {
    setRows(initialRows || []);
    setExpandedId((prev) => {
      if (!initialRows?.length) return null;
      if (prev && initialRows.some((row) => row.id === prev)) return prev;
      return initialRows[0]?.id || null;
    });
  }, [initialRows]);

  useEffect(() => {
    const onCreated = (event: Event) => {
      const detail = (event as CustomEvent<any>).detail || {};
      const nextRow: Row = {
        id: String(detail.id || `tmp-${Date.now()}`),
        employment_record_id: null,
        role_title: detail.role_title ?? null,
        company_name: detail.company_name ?? null,
        start_date: detail.start_date ?? null,
        end_date: detail.end_date ?? null,
        description: detail.description ?? null,
        status: "Sin verificar",
        last_action: "Experiencia guardada",
        source_label: null,
        verification_labels: [],
      };
      setRows((prev) => [nextRow, ...prev]);
      setExpandedId(nextRow.id);
      setMessage("Experiencia guardada correctamente.");
    };
    window.addEventListener(EXPERIENCE_CREATED_EVENT, onCreated as EventListener);
    return () => window.removeEventListener(EXPERIENCE_CREATED_EVENT, onCreated as EventListener);
  }, []);

  function patchRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    setMessage(null);
  }

  async function saveRow(id: string) {
    const row = rows.find((entry) => entry.id === id);
    if (!row) return;

    const roleTitle = String(row.role_title || "").trim();
    const companyName = String(row.company_name || "").trim();
    let startDate: string | null = null;
    let endDate: string | null = null;
    try {
      startDate = parseExperienceDateInput(row.start_date || null).storageValue;
      endDate = isCurrent ? null : parseExperienceDateInput(row.end_date || null, { allowPresent: true }).storageValue;
    } catch (error: any) {
      setMessage(error?.message || "Revisa el formato de las fechas.");
      return;
    }

    if (!roleTitle || !companyName || !startDate) {
      setMessage("Cada experiencia debe incluir empresa, puesto y fecha de inicio.");
      return;
    }

    setSavingId(id);
    setMessage(null);

    const isCurrent = !!editingCurrentById[id];
    const payload = {
      role_title: roleTitle,
      company_name: companyName,
      start_date: startDate,
      end_date: endDate,
      description: String(row.description || "").trim() || null,
    };

    const { error } = await supabase.from("profile_experiences").update(payload).eq("id", id);
    setSavingId(null);

    if (error) {
      setMessage(`No se pudo guardar la experiencia: ${error.message}`);
      return;
    }

    patchRow(id, { end_date: payload.end_date });
    setEditingId(null);
    setMessage("Experiencia actualizada correctamente.");
    router.refresh();
  }

  async function requestVerification(row: Row) {
    const email = String(verificationEmailById[row.id] || "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      setVerifyStateById((prev) => ({ ...prev, [row.id]: "error" }));
      setVerifyMessageById((prev) => ({ ...prev, [row.id]: "Introduce un email válido." }));
      return;
    }

    const { data: au } = await supabase.auth.getUser();
    const user = au?.user;
    if (!user?.id) {
      setVerifyStateById((prev) => ({ ...prev, [row.id]: "error" }));
      setVerifyMessageById((prev) => ({ ...prev, [row.id]: "Usuario no autenticado." }));
      return;
    }

    setVerifyStateById((prev) => ({ ...prev, [row.id]: "loading" }));
    setVerifyMessageById((prev) => ({ ...prev, [row.id]: null }));

    try {
      const payload = buildVerificationPayload(
        {
          ...row,
          company_email: email,
        },
        user.id,
        email,
      );

      const res = await fetch("/api/candidate/verification/create", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.details || json?.error || "No hemos podido enviar la solicitud. Revisa el email o inténtalo de nuevo.");
      }

      setRows((prev) =>
        prev.map((entry) =>
          entry.id === row.id
            ? {
                ...entry,
                status: "Validación solicitada",
                last_action: json?.already_exists === true ? "Validación en curso reutilizada" : "Solicitud enviada",
              }
            : entry,
        ),
      );

      setVerifyStateById((prev) => ({ ...prev, [row.id]: "success" }));
      setVerifyMessageById((prev) => ({
        ...prev,
        [row.id]:
          json?.already_exists === true
            ? "Ya existía una solicitud activa para esta experiencia y este email. Hemos reutilizado la solicitud existente."
            : "Solicitud enviada correctamente.",
      }));
    } catch (err: any) {
      setVerifyStateById((prev) => ({ ...prev, [row.id]: "error" }));
      setVerifyMessageById((prev) => ({
        ...prev,
        [row.id]: err?.message || "No hemos podido enviar la solicitud. Revisa el email o inténtalo de nuevo.",
      }));
    }
  }

  async function deleteRow(row: Row) {
    const confirmed = window.confirm(
      `Vas a eliminar la experiencia de ${row.role_title || "puesto"} en ${row.company_name || "esta empresa"}.`
    );
    if (!confirmed) return;

    setDeletingId(row.id);
    setMessage(null);

    const { error } = await supabase.from("profile_experiences").delete().eq("id", row.id);
    setDeletingId(null);

    if (error) {
      setMessage(`No se pudo eliminar la experiencia: ${error.message}`);
      return;
    }

    setRows((prev) => prev.filter((entry) => entry.id !== row.id));
    if (expandedId === row.id) setExpandedId(null);
    if (editingId === row.id) setEditingId(null);
    setMessage("Experiencia eliminada correctamente.");
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <div className="text-sm text-gray-600">
        Aún no hay experiencias en tu historial. Puedes subir tu CV o añadir una experiencia manualmente.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {message ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div>
      ) : null}

      {rows.map((row) => {
        const isExpanded = expandedId === row.id;
        const isEditing = editingId === row.id;
        const isSaving = savingId === row.id;
        const isDeleting = deletingId === row.id;
        const isVerified = row.status === "Verificada";
        const verifyState = verifyStateById[row.id] || "idle";
        const verifyMessage = verifyMessageById[row.id];

        return (
          <article key={row.id} id={`exp-${row.id}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => {
                setExpandedId((prev) => (prev === row.id ? null : row.id));
                if (!editingCurrentById[row.id]) {
                  setEditingCurrentById((prev) => ({ ...prev, [row.id]: !row.end_date }));
                }
              }}
              className="flex w-full flex-wrap items-start justify-between gap-3 px-4 py-4 text-left hover:bg-slate-50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{row.role_title || "Puesto no especificado"}</h3>
                  {row.source_label ? (
                    <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
                      {row.source_label}
                    </span>
                  ) : null}
                  {Array.isArray(row.verification_labels) && row.verification_labels.map((label) => (
                    <span key={`${row.id}-${label}`} className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-800">
                      {label}
                    </span>
                  ))}
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClasses(row.status)}`}>
                    {row.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-700">{row.company_name || "Empresa no especificada"}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatExperienceDate(row.start_date)} — {formatExperienceDate(row.end_date, { isEnd: true })}
                </p>
              </div>
              <span className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                {isExpanded ? "Ocultar detalle" : "Ver detalle"}
              </span>
            </button>

            {isExpanded ? (
              <div className="border-t border-slate-200 bg-slate-50 px-4 py-4">
                <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Detalle</div>
                      <p className="mt-2 text-sm text-slate-700">
                        {row.description || "Sin descripción todavía. Puedes completar esta experiencia antes de verificarla."}
                      </p>
                      <p className="mt-3 text-xs text-slate-500">Última acción: {row.last_action}</p>
                    </div>

                    {isEditing ? (
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Editar experiencia</div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <input
                            value={row.role_title || ""}
                            onChange={(e) => patchRow(row.id, { role_title: e.target.value })}
                            placeholder="Puesto"
                            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                          />
                          <input
                            value={row.company_name || ""}
                            onChange={(e) => patchRow(row.id, { company_name: e.target.value })}
                            placeholder="Empresa"
                            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                          />
                          <input
                            type="text"
                            inputMode="numeric"
                            value={toExperienceInputValue(row.start_date || "")}
                            onChange={(e) => patchRow(row.id, { start_date: e.target.value })}
                            placeholder="AAAA-MM o MM/AAAA"
                            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                          />
                          <input
                            type="text"
                            inputMode="numeric"
                            value={toExperienceInputValue(row.end_date || "")}
                            onChange={(e) => patchRow(row.id, { end_date: e.target.value })}
                            disabled={!!editingCurrentById[row.id]}
                            placeholder="AAAA-MM, MM/AAAA o Actualidad"
                            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-100"
                          />
                        </div>
                        <label className="mt-3 flex items-center gap-2 text-xs font-medium text-gray-700">
                          <input
                            type="checkbox"
                            checked={!!editingCurrentById[row.id]}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setEditingCurrentById((prev) => ({ ...prev, [row.id]: checked }));
                              if (checked) patchRow(row.id, { end_date: null });
                            }}
                          />
                          Trabajo actualmente aquí
                        </label>
                        <textarea
                          value={row.description || ""}
                          onChange={(e) => patchRow(row.id, { description: e.target.value })}
                          rows={4}
                          placeholder="Descripción"
                          className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                        />
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void saveRow(row.id)}
                            disabled={isSaving}
                            className="inline-flex rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                          >
                            {isSaving ? "Guardando…" : "Guardar cambios"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="inline-flex rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                          >
                            Cerrar edición
                          </button>
                        </div>
                        <p className="text-xs text-slate-500">Puedes escribir `AAAA-MM`, `MM/AAAA` o dejar la fecha final vacía si sigue en curso.</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Acciones</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {!isVerified ? (
                          <button
                            type="button"
                            onClick={() => setEditingId((prev) => (prev === row.id ? null : row.id))}
                            className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                          >
                            {isEditing ? "Cerrar edición" : "Editar experiencia"}
                          </button>
                        ) : null}
                        <Link
                          href={`/candidate/evidence?experience_id=${encodeURIComponent(row.employment_record_id || `profile:${row.id}`)}&company=${encodeURIComponent(row.company_name || "")}&position=${encodeURIComponent(row.role_title || "")}`}
                          className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                        >
                          Vincular documentación
                        </Link>
                        <button
                          type="button"
                          onClick={() => void deleteRow(row)}
                          disabled={isDeleting}
                          className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                        >
                          {isDeleting ? "Eliminando…" : "Eliminar experiencia"}
                        </button>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">
                        Si una experiencia está duplicada o es incorrecta, puedes borrarla antes de continuar.
                      </p>
                    </div>

                    {!isVerified ? (
                      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                        <div className="text-sm font-semibold text-sky-900">Solicitar verificación</div>
                        <p className="mt-1 text-xs text-sky-800">
                          Indica el email de la empresa o de la persona que puede validar esta experiencia.
                        </p>
                        <label className="mt-3 block">
                          <div className="text-xs font-semibold text-gray-900">Email verificador</div>
                          <input
                            id={`verification-contact-${row.id}`}
                            type="email"
                            inputMode="email"
                            name={`verification-contact-${row.id}`}
                            autoComplete={`section-verification-${row.id} off`}
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            value={verificationEmailById[row.id] || ""}
                            onChange={(e) => {
                              setVerificationEmailById((prev) => ({ ...prev, [row.id]: e.target.value }));
                              if (verifyStateById[row.id] !== "idle") {
                                setVerifyStateById((prev) => ({ ...prev, [row.id]: "idle" }));
                                setVerifyMessageById((prev) => ({ ...prev, [row.id]: null }));
                              }
                            }}
                            placeholder="rrhh@empresa.com"
                            className="mt-1 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm"
                          />
                        </label>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void requestVerification(row)}
                            disabled={verifyState === "loading"}
                            className="inline-flex items-center justify-center rounded-lg bg-sky-700 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
                          >
                            {verifyState === "loading" ? "Enviando…" : "Enviar solicitud"}
                          </button>
                        </div>
                        {verifyMessage ? (
                          <div
                            className={`mt-3 rounded-lg border p-3 text-xs ${
                              verifyState === "error"
                                ? "border-rose-200 bg-rose-50 text-rose-700"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {verifyMessage}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
