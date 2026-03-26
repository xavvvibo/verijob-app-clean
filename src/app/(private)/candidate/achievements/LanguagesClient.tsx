"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type LanguageRow = {
  id: string;
  language_name?: string | null;
  proficiency_level?: string | null;
  is_native?: boolean | null;
  notes?: string | null;
  source?: string | null;
  display_order?: number | null;
  is_visible?: boolean | null;
  created_at?: string | null;
};

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

function resolveTitle(item: LanguageRow) {
  return String(item?.notes || "").trim();
}

function resolveLevel(item: LanguageRow) {
  if (item?.is_native) return "Nativo";
  return String(item?.proficiency_level || "—").trim() || "—";
}

function resolveStatus(item: LanguageRow) {
  const rawSource = String(item?.source || "").trim().toLowerCase();
  if (
    rawSource === "documentary_verified" ||
    rawSource === "verified_document" ||
    rawSource === "evidence_verified"
  ) {
    return {
      label: "Verificado documentalmente",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  return {
    label: "Autodeclarado",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  };
}

function normalizePayload(input: { language_name: string; proficiency_level: string; notes: string; is_native: boolean }) {
  return {
    language_name: input.language_name.trim(),
    proficiency_level: input.is_native ? null : input.proficiency_level.trim(),
    is_native: input.is_native,
    notes: input.notes.trim() || null,
    source: "self_declared",
    is_visible: true,
  };
}

export default function LanguagesClient({ initialItems }: { initialItems: LanguageRow[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<LanguageRow[]>(initialItems || []);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newItem, setNewItem] = useState({
    language_name: "",
    proficiency_level: "B1",
    notes: "",
    is_native: false,
  });

  const [draft, setDraft] = useState({
    language_name: "",
    proficiency_level: "B1",
    notes: "",
    is_native: false,
  });

  function startEdit(item: LanguageRow) {
    setEditingId(item.id);
    setDraft({
      language_name: String(item.language_name || "").trim(),
      proficiency_level: String(item.proficiency_level || "B1").trim() || "B1",
      notes: String(item.notes || "").trim(),
      is_native: !!item.is_native,
    });
    setMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft({
      language_name: "",
      proficiency_level: "B1",
      notes: "",
      is_native: false,
    });
  }

  async function addLanguage() {
    const payload = normalizePayload(newItem);
    if (!payload.language_name) {
      setMessage("Indica al menos el idioma.");
      return;
    }

    setSaving(true);
    setMessage(null);

    const { data, error } = await supabase
      .from("candidate_languages")
      .insert(payload)
      .select("*")
      .single();

    setSaving(false);

    if (error || !data) {
      setMessage(`No se pudo guardar el idioma: ${error?.message || "error desconocido"}`);
      return;
    }

    setItems((prev) => [data as LanguageRow, ...prev]);
    setNewItem({
      language_name: "",
      proficiency_level: "B1",
      notes: "",
      is_native: false,
    });
    setAdding(false);
    setMessage("Idioma añadido correctamente.");
  }

  async function saveEdit(id: string) {
    const payload = normalizePayload(draft);
    if (!payload.language_name) {
      setMessage("Indica al menos el idioma.");
      return;
    }

    setSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from("candidate_languages")
      .update(payload)
      .eq("id", id);

    setSaving(false);

    if (error) {
      setMessage(`No se pudo guardar el idioma: ${error.message}`);
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              language_name: payload.language_name,
              proficiency_level: payload.proficiency_level,
              notes: payload.notes,
              is_native: payload.is_native,
              source: payload.source,
              is_visible: payload.is_visible,
            }
          : item,
      ),
    );

    cancelEdit();
    setMessage("Idioma actualizado correctamente.");
  }

  async function deleteItem(id: string) {
    const confirmed = window.confirm("¿Seguro que quieres eliminar este idioma?");
    if (!confirmed) return;

    setSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from("candidate_languages")
      .delete()
      .eq("id", id);

    setSaving(false);

    if (error) {
      setMessage(`No se pudo eliminar el idioma: ${error.message}`);
      return;
    }

    setItems((prev) => prev.filter((item) => item.id !== id));
    if (editingId === id) cancelEdit();
    setMessage("Idioma eliminado correctamente.");
  }

  return (
    <div className="space-y-8">
      <section className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Idiomas</h2>
            <p className="mt-1 text-sm text-slate-600">
              Señales lingüísticas claras, sin ruido visual y con una lectura rápida para empresas.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setAdding((prev) => !prev);
              setMessage(null);
            }}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            {adding ? "Cerrar" : "Añadir idioma"}
          </button>
        </div>

        {adding ? (
          <div className="rounded-2xl bg-slate-50 px-5 py-5">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_140px_minmax(0,1.2fr)_auto]">
              <label className="block">
                <div className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Idioma</div>
                <input
                  value={newItem.language_name}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, language_name: e.target.value }))}
                  placeholder="Ej. Inglés"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>

              <label className="block">
                <div className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Nivel</div>
                <select
                  value={newItem.proficiency_level}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, proficiency_level: e.target.value }))}
                  disabled={newItem.is_native}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
                >
                  {LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <div className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Título o certificado</div>
                <input
                  value={newItem.notes}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Ej. Cambridge C2 Proficiency"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => void addLanguage()}
                  disabled={saving}
                  className="inline-flex h-[42px] items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                >
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={newItem.is_native}
                onChange={(e) => setNewItem((prev) => ({ ...prev, is_native: e.target.checked }))}
              />
              Idioma nativo
            </label>
          </div>
        ) : null}

        {message ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}

        <div className="border-t border-slate-100 pt-2">
          <div className="hidden grid-cols-[minmax(0,1.1fr)_140px_minmax(0,1.2fr)_220px_140px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 xl:grid">
            <div>Idioma</div>
            <div>Nivel</div>
            <div>Título</div>
            <div>Estado</div>
            <div className="text-right">Acciones</div>
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-5 text-sm text-slate-600">
              Aún no has añadido idiomas.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((item) => {
                const title = resolveTitle(item);
                const status = resolveStatus(item);
                const isEditing = editingId === item.id;

                return (
                  <div key={item.id} className="px-1 py-5 transition-colors duration-150 hover:bg-slate-50/50 lg:px-4">
                    {isEditing ? (
                      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_140px_minmax(0,1.2fr)_220px_140px] xl:items-center">
                        <input
                          value={draft.language_name}
                          onChange={(e) => setDraft((prev) => ({ ...prev, language_name: e.target.value }))}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                        />

                        <select
                          value={draft.proficiency_level}
                          onChange={(e) => setDraft((prev) => ({ ...prev, proficiency_level: e.target.value }))}
                          disabled={draft.is_native}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
                        >
                          {LEVELS.map((level) => (
                            <option key={level} value={level}>
                              {level}
                            </option>
                          ))}
                        </select>

                        <input
                          value={draft.notes}
                          onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
                          placeholder="Título o certificado"
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                        />

                        <div className="space-y-2">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}>
                            {status.label}
                          </span>
                          <label className="flex items-center gap-2 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={draft.is_native}
                              onChange={(e) => setDraft((prev) => ({ ...prev, is_native: e.target.checked }))}
                            />
                            Idioma nativo
                          </label>
                        </div>

                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void saveEdit(item.id)}
                            disabled={saving}
                          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-black disabled:opacity-60"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_140px_minmax(0,1.2fr)_220px_140px] xl:items-center">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {String(item.language_name || "Idioma sin indicar").trim()}
                          </div>
                        </div>

                        <div className="text-sm text-slate-700">
                          {resolveLevel(item)}
                        </div>

                        <div className="text-sm text-slate-600">
                          {title || "Sin certificado indicado"}
                        </div>

                        <div>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}>
                            {status.label}
                          </span>
                        </div>

                        <div className="flex justify-end gap-3 text-sm">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="font-medium text-slate-700 hover:text-slate-900"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteItem(item.id)}
                            className="font-medium text-rose-600 hover:text-rose-700"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    )}

                    {!isEditing ? (
                      <div className="mt-3 grid gap-2 lg:hidden">
                        <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Nivel</div>
                        <div className="text-sm text-slate-700">{resolveLevel(item)}</div>
                        <div className="text-xs uppercase tracking-[0.12em] text-slate-400">Título</div>
                        <div className="text-sm text-slate-600">{title || "Sin certificado indicado"}</div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
