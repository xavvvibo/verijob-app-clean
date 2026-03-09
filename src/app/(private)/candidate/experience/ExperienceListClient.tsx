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

export default function ExperienceListClient({ initialRows }: { initialRows: Row[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function formatExperienceDate(value: any, { isEnd = false }: { isEnd?: boolean } = {}) {
    const raw = String(value || "").trim();
    if (!raw) return isEnd ? "Presente" : "Fecha no indicada";
    const lower = raw.toLowerCase();
    if (lower.includes("actual") || lower.includes("present")) return "Presente";

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

  async function saveRow(id: string) {
    const row = rows.find((x) => x.id === id);
    if (!row) return;

    setSavingId(id);
    setMessage(null);

    const payload = {
      role_title: String(row.role_title || "").trim() || null,
      company_name: String(row.company_name || "").trim() || null,
      start_date: String(row.start_date || "").trim() || null,
      end_date: String(row.end_date || "").trim() || null,
      description: String(row.description || "").trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("profile_experiences").update(payload).eq("id", id);
    setSavingId(null);

    if (error) {
      setMessage(`No se pudo guardar la experiencia: ${error.message}`);
      return;
    }

    setEditingId(null);
    setMessage("Experiencia actualizada correctamente.");
  }

  if (rows.length === 0) {
    return (
      <div className="text-sm text-gray-600">
        Aún no hay experiencias en tu historial. Puedes subir tu CV o añadir una experiencia manualmente.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {message ? <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div> : null}

      {rows.map((r) => {
        const isVerified = r.status === "Verificado";
        const isEditing = editingId === r.id;
        const isSaving = savingId === r.id;

        return (
          <div key={r.id} id={`exp-${r.id}`} className="rounded-2xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold">Puesto: {r.role_title || "No especificado"}</div>
                  <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700">
                    Empresa: {r.company_name || "No especificada"}
                  </span>
                  <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700">
                    Estado: {r.status}
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-600">
                  Fechas: {formatExperienceDate(r.start_date)} — {formatExperienceDate(r.end_date, { isEnd: true })}
                </div>
                <div className="mt-2 text-xs text-gray-500">Email de verificación de la empresa: se solicitará en el flujo de solicitud.</div>
              </div>

              {!isVerified ? (
                <button
                  type="button"
                  onClick={() => setEditingId((prev) => (prev === r.id ? null : r.id))}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                >
                  {isEditing ? "Cerrar edición" : "Editar"}
                </button>
              ) : null}
            </div>

            {r.description ? <div className="mt-3 text-sm text-gray-700">{r.description}</div> : null}
            {!isVerified ? <div className="mt-2 text-xs text-blue-700">Verifica esta experiencia para aumentar tu credibilidad.</div> : null}
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
                    value={r.start_date || ""}
                    onChange={(e) => patchRow(r.id, { start_date: e.target.value })}
                    placeholder="Inicio (YYYY-MM)"
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  />
                  <input
                    value={r.end_date || ""}
                    onChange={(e) => patchRow(r.id, { end_date: e.target.value })}
                    placeholder="Fin (YYYY-MM o vacío si presente)"
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
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

            <div className="mt-4 space-y-3">
              <form action="/candidate/verifications/new" method="get" className="rounded-xl border border-gray-200 p-3">
                <input type="hidden" name="source_profile_experience_id" value={r.id || ""} />
                <input type="hidden" name="company" value={r.company_name || ""} />
                <input type="hidden" name="position" value={r.role_title || ""} />
                <input type="hidden" name="start" value={r.start_date || ""} />
                <input type="hidden" name="end" value={r.end_date || ""} />
                <label className="block">
                  <div className="text-xs font-semibold text-gray-900">Email de verificación de la empresa</div>
                  <input
                    type="email"
                    name="company_email"
                    placeholder="Indica el email al que quieres enviar esta solicitud"
                    required
                    className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900"
                  />
                </label>
                <button
                  type="submit"
                  className="mt-3 inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                >
                  Solicitar verificación a empresa
                </button>
              </form>

              <Link
                href={`/candidate/evidence?experience_id=${encodeURIComponent(r.id)}&company=${encodeURIComponent(r.company_name || "")}&position=${encodeURIComponent(r.role_title || "")}`}
                className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
              >
                Verificar documentalmente
              </Link>
              <div className="text-xs text-blue-700">Sube una evidencia para reforzar esta experiencia.</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
