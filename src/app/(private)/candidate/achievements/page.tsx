"use client";

import { useEffect, useState } from "react";

type AchievementItem = {
  title: string;
  issuer: string;
  date: string;
  description: string;
  category: "certificacion" | "premio" | "idioma" | "otro";
};

const EMPTY_ITEM: AchievementItem = {
  title: "",
  issuer: "",
  date: "",
  description: "",
  category: "otro",
};

function normalizeAchievements(raw: any): AchievementItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x: any) => ({
    title: String(x?.title ?? ""),
    issuer: String(x?.issuer ?? ""),
    date: String(x?.date ?? ""),
    description: String(x?.description ?? ""),
    category: (["certificacion", "premio", "idioma", "otro"].includes(String(x?.category)) ? x.category : "otro") as AchievementItem["category"],
  }));
}

function groupLabel(category: AchievementItem["category"]) {
  if (category === "idioma") return "Idiomas";
  if (category === "certificacion") return "Certificaciones";
  if (category === "premio") return "Premios";
  return "Otros logros";
}

function toPayload(items: AchievementItem[]) {
  return items
    .map((x) => ({
      title: x.title.trim(),
      issuer: x.issuer.trim() || null,
      date: x.date.trim() || null,
      description: x.description.trim() || null,
      category: x.category,
    }))
    .filter((x) => x.title || x.issuer || x.date || x.description);
}

export default function CandidateAchievementsPage() {
  const [items, setItems] = useState<AchievementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/candidate/profile", { credentials: "include", cache: "no-store" as any });
      const j = await r.json().catch(() => ({}));
      setItems(normalizeAchievements(j?.profile?.achievements_catalog?.all || j?.profile?.achievements || j?.profile?.certifications));
      setLoading(false);
    })();
  }, []);

  function update(idx: number, patch: Partial<AchievementItem>) {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    setItems(next);
    setMessage(null);
  }

  function add() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
    setMessage(null);
  }

  function remove(idx: number) {
    const ok = window.confirm("¿Seguro que quieres eliminar este logro?");
    if (!ok) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setMessage(null);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const profileRes = await fetch("/api/candidate/profile", { credentials: "include", cache: "no-store" as any });
    const profileJson = await profileRes.json().catch(() => ({}));

    const body = {
      summary: profileJson?.profile?.summary ?? null,
      education: Array.isArray(profileJson?.profile?.education) ? profileJson.profile.education : [],
      achievements: toPayload(items),
    };

    const r = await fetch("/api/candidate/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    const j = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) {
      setMessage(j?.error || "No se pudieron guardar los logros.");
      return;
    }

    setItems(normalizeAchievements(j?.profile?.achievements_catalog?.all || j?.profile?.achievements || j?.profile?.certifications));
    setMessage("Logros guardados correctamente.");
  }

  const grouped = items.reduce<Record<string, AchievementItem[]>>((acc, item) => {
    const key = item.category;
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-gray-200 bg-white p-5">
        <h1 className="text-2xl font-semibold text-gray-900">Idiomas y otros logros</h1>
        <p className="mt-2 text-sm text-gray-600">
          Gestiona idiomas, certificados oficiales, premios, cursos y otros méritos verificables desde esta sección.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Puedes preparar aquí la información de certificación para futuras validaciones documentales.
        </p>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900">Registros de idiomas y logros</h2>
          <button
            type="button"
            onClick={add}
            className="inline-flex rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
          >
            Añadir registro
          </button>
        </div>

        {loading ? <p className="mt-4 text-sm text-gray-600">Cargando…</p> : null}

        {!loading && items.length === 0 ? (
          <p className="mt-4 text-sm text-gray-600">Todavía no has añadido idiomas, certificados o logros.</p>
        ) : null}

        {!loading && items.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {(["idioma", "certificacion", "premio", "otro"] as AchievementItem["category"][]).map((category) => (
              <div key={category} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{groupLabel(category)}</div>
                <div className="mt-2 text-2xl font-semibold text-gray-900">{grouped[category]?.length || 0}</div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {items.map((item, idx) => (
            <article key={idx} className="rounded-xl border border-gray-200 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Título" value={item.title} onChange={(v) => update(idx, { title: v })} />
                <label className="block">
                  <div className="text-sm font-semibold text-gray-900">Categoría</div>
                  <select
                    value={item.category}
                    onChange={(e) => update(idx, { category: e.target.value as AchievementItem["category"] })}
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  >
                    <option value="certificacion">Certificación</option>
                    <option value="premio">Premio</option>
                    <option value="idioma">Idioma</option>
                    <option value="otro">Otro logro</option>
                  </select>
                </label>
                <Field label="Entidad / emisor (si aplica)" value={item.issuer} onChange={(v) => update(idx, { issuer: v })} />
                <Field label="Fecha" value={item.date} onChange={(v) => update(idx, { date: v })} placeholder="YYYY-MM" />
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="text-sm font-semibold text-gray-900">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
      />
    </label>
  );
}
