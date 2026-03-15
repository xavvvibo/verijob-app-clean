"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Row = {
  id: string;
  role_title: string | null;
  company_name: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  status: "Importado" | "Sin verificar" | "En verificación" | "Verificado" | "Revocado";
  last_action: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type VerifyState = "idle" | "loading" | "success" | "error";

export default function ExperienceListClient({ initialRows }: { initialRows: Row[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingCurrentById, setEditingCurrentById] = useState<Record<string, boolean>>({});

  const [verificationEmailById, setVerificationEmailById] = useState<Record<string, string>>({});
  const [verifyStateById, setVerifyStateById] = useState<Record<string, VerifyState>>({});
  const [verifyMessageById, setVerifyMessageById] = useState<Record<string, string | null>>({});

  function formatExperienceDate(value: any, { isEnd = false }: { isEnd?: boolean } = {}) {
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

  function patchRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setMessage(null);
  }

  function normalizeDateForSave(value: string | null) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const ym = raw.match(/^(\d{4})-(\d{2})$/);
    if (ym) return `${ym[1]}-${ym[2]}-01`;
    const dmy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
    return raw;
  }

  async function saveRow(id: string) {
    const row = rows.find((x) => x.id === id);
    if (!row) return;

    const roleTitle = String(row.role_title || "").trim();
    const companyName = String(row.company_name || "").trim();
    const startDate = normalizeDateForSave(row.start_date || null);
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
      end_date: isCurrent ? null : normalizeDateForSave(row.end_date || null),
      description: String(row.description || "").trim() || null,
      updated_at: new Date().toISOString(),
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
  }

  async function requestVerification(row: Row) {
    const email = String(verificationEmailById[row.id] || "").trim();
    if (!EMAIL_RE.test(email)) {
      setVerifyStateById((prev) => ({ ...prev, [row.id]: "error" }));
      setVerifyMessageById((prev) => ({ ...prev, [row.id]: "Introduce un email válido." }));
      return;
    }

    const { data: au } = await supabase.auth.getUser();
    const user = au?.user;
    if (!user) {
      setVerifyStateById((prev) => ({ ...prev, [row.id]: "error" }));
      setVerifyMessageById((prev) => ({ ...prev, [row.id]: "Usuario no autenticado." }));
      return;
    }

    setVerifyStateById((prev) => ({ ...prev, [row.id]: "loading" }));
    setVerifyMessageById((prev) => ({ ...prev, [row.id]: null }));

    try {
      const res = await fetch("/api/candidate/verification/create", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          employment_record_id: row.id,
          company_name_freeform: row.company_name || "",
          company_email: email,
          position: row.role_title || "",
          start_date: normalizeDateForSave(row.start_date || null),
          end_date: row.end_date ? normalizeDateForSave(row.end_date) : null,
          is_current: !row.end_date,
          source_profile_experience_id: row.id,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "No hemos podido enviar la solicitud. Revisa el email o inténtalo de nuevo.");
      }

      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? {
                ...r,
                status: "En verificación",
                last_action: json?.already_exists === true ? "Solicitud activa reutilizada" : "Solicitud enviada",
              }
            : r,
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

  if (rows.length === 0) {
    return <div className="text-sm text-gray-600">Aún no hay experiencias en tu historial. Puedes subir tu CV o añadir una experiencia manualmente.</div>;
  }

  return (
    <div className="space-y-2">
      {message ? <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div> : null}

      {rows.map((r) => {
        const isVerified = r.status === "Verificado";
        const isEditing = editingId === r.id;
        const isSaving = savingId === r.id;
        const verifyState = verifyStateById[r.id] || "idle";
        const verifyMessage = verifyMessageById[r.id];

        return (
          <div key={r.id} id={`exp-${r.id}`} className="rounded-2xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold">Puesto: {r.role_title || "No especificado"}</div>
                  <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700">Empresa: {r.company_name || "No especificada"}</span>
                  <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700">Estado: {r.status}</span>
                </div>
                <div className="mt-1 text-xs text-gray-600">
                  Fechas: {formatExperienceDate(r.start_date)} — {formatExperienceDate(r.end_date, { isEnd: true })}
                </div>
              </div>

              {!isVerified ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId((prev) => (prev === r.id ? null : r.id));
                    if (!editingCurrentById[r.id]) {
                      setEditingCurrentById((prev) => ({ ...prev, [r.id]: !r.end_date }));
                    }
                  }}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                >
                  {isEditing ? "Cerrar edición" : "Editar"}
                </button>
              ) : null}
            </div>

            {r.description ? <div className="mt-3 text-sm text-gray-700">{r.description}</div> : null}
            {!isVerified ? <div className="mt-2 text-xs text-blue-700">Haz verificable esta experiencia.</div> : null}
            <div className="mt-1 text-xs text-gray-500">Última acción: {r.last_action}</div>

            {isEditing ? (
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div className="mb-2 text-xs font-semibold text-gray-700">Edición rápida de experiencia</div>
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    value={r.role_title || ""}
                    onChange={(e) => patchRow(r.id, { role_title: e.target.value })}
                    placeholder="Puesto"
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  />
                  <input
                    value={r.company_name || ""}
                    onChange={(e) => patchRow(r.id, { company_name: e.target.value })}
                    placeholder="Empresa"
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  />
                  <input
                    type="month"
                    lang="es"
                    value={(r.start_date || "").slice(0, 7)}
                    onChange={(e) => patchRow(r.id, { start_date: e.target.value })}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  />
                  <input
                    type="month"
                    lang="es"
                    value={(r.end_date || "").slice(0, 7)}
                    onChange={(e) => patchRow(r.id, { end_date: e.target.value })}
                    disabled={!!editingCurrentById[r.id]}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-100"
                  />
                </div>
                <label className="mt-2 flex items-center gap-2 text-xs font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={!!editingCurrentById[r.id]}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setEditingCurrentById((prev) => ({ ...prev, [r.id]: checked }));
                      if (checked) patchRow(r.id, { end_date: null });
                    }}
                  />
                  Trabajo actualmente aquí
                </label>
                <textarea
                  value={r.description || ""}
                  onChange={(e) => patchRow(r.id, { description: e.target.value })}
                  rows={3}
                  placeholder="Descripción"
                  className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                />
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void saveRow(r.id)}
                    disabled={isSaving}
                    className="inline-flex rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                  >
                    {isSaving ? "Guardando…" : "Guardar edición"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="inline-flex rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : null}

            {!isVerified ? (
              <div className="mt-4 space-y-3 rounded-xl border border-blue-100 bg-blue-50 p-3">
                <div className="text-sm font-semibold text-blue-900">Verificar esta experiencia</div>

                <label className="block">
                  <div className="text-xs font-semibold text-gray-900">Email de la persona o empresa que puede validar esta experiencia</div>
                  <input
                    type="email"
                    value={verificationEmailById[r.id] || ""}
                    onChange={(e) => {
                      setVerificationEmailById((prev) => ({ ...prev, [r.id]: e.target.value }));
                      if (verifyStateById[r.id] !== "idle") {
                        setVerifyStateById((prev) => ({ ...prev, [r.id]: "idle" }));
                        setVerifyMessageById((prev) => ({ ...prev, [r.id]: null }));
                      }
                    }}
                    placeholder="ejemplo@empresa.com"
                    className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void requestVerification(r)}
                  disabled={verifyState === "loading" || verifyState === "success"}
                  className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {verifyState === "loading"
                    ? "Enviando solicitud..."
                    : verifyState === "success"
                      ? "Solicitud activa"
                      : "Solicitar verificación a la empresa"}
                </button>

                <Link
                  href={`/candidate/evidence?experience_id=${encodeURIComponent(r.id)}&company=${encodeURIComponent(r.company_name || "")}&position=${encodeURIComponent(r.role_title || "")}`}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                >
                  Subir evidencia documental
                </Link>
                <div className="text-xs text-blue-700">Añade una evidencia documental.</div>

                {verifyMessage ? (
                  <div
                    className={`rounded-lg border p-2 text-xs ${
                      verifyState === "success"
                        ? "border-green-200 bg-green-50 text-green-800"
                        : verifyState === "error"
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-gray-200 bg-white text-gray-700"
                    }`}
                  >
                    {verifyMessage}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
