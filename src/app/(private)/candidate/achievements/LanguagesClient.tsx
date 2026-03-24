"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type LanguageRow = {
  id: string;
  language?: string | null;
  level?: string | null;
  title?: string | null;
  certificate_title?: string | null;
  verification_status?: string | null;
  created_at?: string | null;
};

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "Nativo"];

function resolveTitle(item: any) {
  return String(item?.title || item?.certificate_title || "").trim();
}

function resolveStatus(item: any) {
  const raw = String(item?.verification_status || "").trim().toLowerCase();
  if (raw === "verified" || raw === "document_verified" || raw === "validated") {
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

function normalizePayload(input: { language: string; level: string; title: string }) {
  return {
    language: input.language.trim(),
    level: input.level.trim(),
    title: input.title.trim() || null,
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
    language: "",
    level: "B1",
    title: "",
  });

  const [draft, setDraft] = useState({
    language: "",
    level: "B1",
    title: "",
  });

  function startEdit(item: LanguageRow) {
    setEditingId(item.id);
    setDraft({
      language: String(item.language || "").trim(),
      level: String(item.level || "B1").trim() || "B1",
      title: resolveTitle(item),
    });
    setMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft({
      language: "",
      level: "B1",
      title: "",
    });
  }

  async function addLanguage() {
    const payload = normalizePayload(newItem);
    if (!payload.language) {
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
      setMessage(`No se pudo añadir el idioma: ${error?.message || "error desconocido"}`);
      return;
    }

    setItems((prev) => [data as LanguageRow, ...prev]);
    setNewItem({ language: "", level: "B1", title: "" });
    setAdding(false);
    setMessage("Idioma añadido correctamente.");
  }

  async function saveEdit(id: string) {
    const payload = normalizePayload(draft);
    if (!payload.language) {
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
              language: payload.language,
              level: payload.level,
              title: payload.title,
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
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Idiomas</h2>
            <p className="mt-1 text-sm text-slate-600">
              Mantén una lista limpia y fácil de revisar. Cada idioma muestra nivel, certificado y estado.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setAdding((prev) => !prev);
              setMessage(null);
            }}
            className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          >
            {adding ? "Cerrar" : "Añadir idioma"}
          </button>
        </div>

        {adding ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-3 md:grid-cols-[1.2fr_140px_1.4fr_auto]">
              <label className="block">
                <div className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Idioma</div>
                <input
                  value={newItem.language}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, language: e.target.value }))}
                  placeholder="Ej. Inglés"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>

              <label className="block">
                <div className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Nivel</div>
                <select
                  value={newItem.level}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, level: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
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
                  value={newItem.title}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Ej. Cambridge C2 Proficiency"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => void addLanguage()}
                  disabled={saving}
                  className="inline-flex h-[42px] items-center justify-center rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {message ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
          <div className="hidden grid-cols-[1.2fr_140px_1.5fr_220px_140px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 lg:grid">
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
            <div className="divide-y divide-slate-200">
              {items.map((item) => {
                const title = resolveTitle(item);
                const status = resolveStatus(item);
                const isEditing = editingId === item.id;

                return (
                  <div key={item.id} className="px-4 py-4">
                    {isEditing ? (
                      <div className="grid gap-3 lg:grid-cols-[1.2fr_140px_1.5fr_220px_140px] lg:items-center">
                        <input
                          value={draft.language}
                          onChange={(e) => setDraft((prev) => ({ ...prev, language: e.target.value }))}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                        />

                        <select
                          value={draft.level}
                          onChange={(e) => setDraft((prev) => ({ ...prev, level: e.target.value }))}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                        >
                          {LEVELS.map((level) => (
                            <option key={level} value={level}>
                              {level}
                            </option>
                          ))}
                        </select>

                        <input
                          value={draft.title}
                          onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                          placeholder="Título o certificado"
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                        />

                        <div>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}>
                            {status.label}
                          </span>
                        </div>

                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void saveEdit(item.id)}
                            disabled={saving}
                            className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
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
                      <div className="grid gap-3 lg:grid-cols-[1.2fr_140px_1.5fr_220px_140px] lg:items-center">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {String(item.language || "Idioma sin indicar").trim()}
                          </div>
                        </div>

                        <div className="text-sm text-slate-700">
                          {String(item.level || "—").trim()}
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
                        <div className="text-sm text-slate-700">{String(item.level || "—").trim()}</div>
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
