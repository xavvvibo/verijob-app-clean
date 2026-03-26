"use client";

import { useEffect, useState } from "react";
import CandidatePageHero from "../_components/CandidatePageHero";

type EducationItem = {
  title: string;
  institution: string;
  start_date: string;
  end_date: string;
  description: string;
  in_progress?: boolean;
};

const EMPTY_ITEM: EducationItem = {
  title: "",
  institution: "",
  start_date: "",
  end_date: "",
  description: "",
  in_progress: false,
};

function normalizeEducation(raw: any): EducationItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x: any) => ({
    title: String(x?.title ?? ""),
    institution: String(x?.institution ?? ""),
    start_date: String(x?.start_date ?? ""),
    end_date: String(x?.end_date ?? ""),
    description: String(x?.description ?? ""),
    in_progress: Boolean(x?.in_progress),
  }));
}

function toPayload(items: EducationItem[]) {
  return items
    .map((x) => ({
      title: x.title.trim(),
      institution: x.institution.trim(),
      start_date: x.start_date.trim() || null,
      end_date: x.in_progress ? null : x.end_date.trim() || null,
      description: x.description.trim() || null,
      in_progress: !!x.in_progress,
    }))
    .filter((x) => x.title || x.institution || x.start_date || x.end_date || x.description);
}

function toUiError(message: unknown) {
  const raw = String(message || "").trim();
  if (!raw) return "No se pudo guardar la formación.";
  return "No se pudo guardar la formación. Revisa los datos y vuelve a intentarlo.";
}

export default function CandidateEducationPage() {
  const [items, setItems] = useState<EducationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/candidate/education", { credentials: "include", cache: "no-store" as any });
      const j = await r.json().catch(() => ({}));
      const normalized = normalizeEducation(j?.items);
      setItems(normalized);
      setExpandedIndex(normalized.length === 1 ? 0 : null);
      setLoading(false);
    })();
  }, []);

  function update(idx: number, patch: Partial<EducationItem>) {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    setItems(next);
    setMessage(null);
  }

  function add() {
    setItems((prev) => [{ ...EMPTY_ITEM }, ...prev]);
    setExpandedIndex(0);
    setMessage("Nuevo estudio listo para completar.");
  }

  function remove(idx: number) {
    const ok = window.confirm("¿Seguro que quieres eliminar este registro académico?");
    if (!ok) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setExpandedIndex((prev) => {
      if (prev === null) return null;
      if (prev === idx) return null;
      return prev > idx ? prev - 1 : prev;
    });
    setMessage(null);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const r = await fetch("/api/candidate/education", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: toPayload(items),
      }),
    });

    const j = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) {
      setMessage(toUiError(j?.details || j?.error));
      return;
    }

    setItems(normalizeEducation(j?.items));
    setExpandedIndex(null);
    setMessage("Formación guardada correctamente.");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-14 px-6 py-10">
      <CandidatePageHero
        eyebrow="Educación"
        title="Tu formación en una vista clara"
        description="Reúne tu formación en un solo lugar y deja lista la parte académica del perfil sin convertirla en ruido visual."
        badges={["Formación visible", "Edición rápida", "Lectura limpia"]}
      />

      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Registros académicos</h2>
            <p className="mt-1 text-sm text-slate-500">Mantén una lista breve, ordenada y fácil de revisar.</p>
          </div>
          <button
            type="button"
            onClick={add}
            className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            Añadir estudios
          </button>
        </div>

        {loading ? <p className="mt-4 text-sm text-gray-600">Cargando…</p> : null}

        {!loading && items.length === 0 ? (
          <p className="mt-4 text-sm text-gray-600">Todavía no has añadido formación académica.</p>
        ) : null}

        <div className="space-y-5 border-t border-slate-100 pt-4">
          {items.map((item, idx) => (
            <article key={idx} className="border-b border-slate-100 pb-5 last:border-b-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold text-slate-950">
                    {item.title || item.institution ? `${item.title || "Estudio"}${item.institution ? ` — ${item.institution}` : ""}` : "Nuevo estudio"}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                    {[item.start_date || "Inicio pendiente", item.in_progress ? "En curso" : item.end_date || "Fin pendiente"].join(" · ")}
                  </div>
                  {item.description ? <div className="mt-2 line-clamp-2 text-sm text-slate-500">{item.description}</div> : null}
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedIndex((prev) => (prev === idx ? null : idx))}
                  className="inline-flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {expandedIndex === idx ? "Ocultar" : "Editar"}
                </button>
              </div>

              {expandedIndex === idx ? (
                <>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <Field label="Centro / institución" value={item.institution} onChange={(v) => update(idx, { institution: v })} />
                    <Field label="Título / estudio" value={item.title} onChange={(v) => update(idx, { title: v })} />
                    <Field label="Fecha inicio" value={item.start_date} onChange={(v) => update(idx, { start_date: v })} placeholder="YYYY-MM" />
                    <Field
                      label="Fecha fin"
                      value={item.end_date}
                      onChange={(v) => update(idx, { end_date: v })}
                      placeholder="YYYY-MM"
                      disabled={!!item.in_progress}
                    />
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={!!item.in_progress}
                        onChange={(e) => update(idx, { in_progress: e.target.checked })}
                      />
                      En curso
                    </label>
                  </div>

                  <label className="mt-4 block">
                    <div className="text-sm font-semibold text-slate-900">Descripción breve</div>
                    <textarea
                      value={item.description}
                      onChange={(e) => update(idx, { description: e.target.value })}
                      rows={3}
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    />
                  </label>

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="inline-flex rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      Eliminar
                    </button>
                  </div>
                </>
              ) : null}
            </article>
          ))}
        </div>

        <div className="flex items-center gap-3 border-t border-slate-100 pt-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
          {message ? <p className="text-sm text-slate-600">{message}</p> : null}
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <div className="text-sm font-semibold text-slate-900">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50"
      />
    </label>
  );
}
