"use client";

import { useEffect, useState } from "react";

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
    <div className="space-y-4">
      <header className="rounded-2xl border border-gray-200 bg-white p-5">
        <h1 className="text-2xl font-semibold text-gray-900">Educación</h1>
        <p className="mt-2 text-sm text-gray-600">
          Gestiona tu formación desde esta sección sin salir de la página.
        </p>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900">Registros académicos</h2>
          <button
            type="button"
            onClick={add}
            className="inline-flex rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
          >
            Añadir estudios
          </button>
        </div>

        {loading ? <p className="mt-4 text-sm text-gray-600">Cargando…</p> : null}

        {!loading && items.length === 0 ? (
          <p className="mt-4 text-sm text-gray-600">Todavía no has añadido formación académica.</p>
        ) : null}

        <div className="mt-4 space-y-3">
          {items.map((item, idx) => (
            <article key={idx} className="rounded-xl border border-gray-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-900">
                    {item.title || item.institution ? `${item.title || "Estudio"}${item.institution ? ` — ${item.institution}` : ""}` : "Nuevo estudio"}
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    {[item.start_date || "Inicio pendiente", item.in_progress ? "En curso" : item.end_date || "Fin pendiente"].join(" · ")}
                  </div>
                  {item.description ? <div className="mt-2 line-clamp-2 text-xs text-gray-500">{item.description}</div> : null}
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedIndex((prev) => (prev === idx ? null : idx))}
                  className="inline-flex rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                >
                  {expandedIndex === idx ? "Ocultar" : "Editar"}
                </button>
              </div>

              {expandedIndex === idx ? (
                <>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
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

                  <label className="mt-3 block">
                    <div className="text-sm font-semibold text-gray-900">Descripción breve</div>
                    <textarea
                      value={item.description}
                      onChange={(e) => update(idx, { description: e.target.value })}
                      rows={3}
                      className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                  </label>

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="inline-flex rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </div>
                </>
              ) : null}
            </article>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
          {message ? <p className="text-sm text-gray-600">{message}</p> : null}
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
      <div className="text-sm font-semibold text-gray-900">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:bg-gray-50"
      />
    </label>
  );
}
