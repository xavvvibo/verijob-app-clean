"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type AchievementCategory = "certificacion" | "premio" | "idioma" | "otro";
type EditorMode = "language" | "certification";

type AchievementItem = {
  title: string;
  language: string;
  level: string;
  certificate_title: string;
  issuer: string;
  date: string;
  description: string;
  category: AchievementCategory;
};

const LANGUAGE_LEVEL_OPTIONS = ["A1", "A2", "B1", "B2", "C1", "C2", "Nativo"] as const;

const EMPTY_LANGUAGE: AchievementItem = {
  title: "",
  language: "",
  level: "",
  certificate_title: "",
  issuer: "",
  date: "",
  description: "",
  category: "idioma",
};

const EMPTY_CERTIFICATION: AchievementItem = {
  title: "",
  language: "",
  level: "",
  certificate_title: "",
  issuer: "",
  date: "",
  description: "",
  category: "certificacion",
};

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function toUiSaveError(message: unknown) {
  const raw = normalizeText(message).toLowerCase();
  if (!raw) return "No se pudieron guardar los idiomas y logros.";
  if (raw.includes("candidate_profile_write_failed")) return "No se pudieron guardar todavía tus idiomas y logros. Vuelve a intentarlo.";
  if (raw.includes("candidate_profile_persistence_mismatch")) return "Guardamos los cambios, pero no pudimos confirmarlos al volver a leer el perfil. Recarga y vuelve a intentarlo.";
  if (raw.includes("profile_languages_update")) return "No se pudieron actualizar los idiomas del perfil. Vuelve a intentarlo.";
  return normalizeText(message) || "No se pudieron guardar los idiomas y logros.";
}

function normalizeAchievements(raw: any): AchievementItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x: any) => {
    const rawCategory = normalizeText(x?.category).toLowerCase();
    const category: AchievementCategory =
      rawCategory === "idioma" || rawCategory === "certificacion" || rawCategory === "premio"
        ? (rawCategory as AchievementCategory)
        : "otro";

    return {
      title: normalizeText(x?.title),
      language: normalizeText(x?.language || (category === "idioma" ? x?.title : "")),
      level: normalizeText(x?.level),
      certificate_title: normalizeText(x?.certificate_title),
      issuer: normalizeText(x?.issuer),
      date: normalizeText(x?.date),
      description: normalizeText(x?.description),
      category,
    };
  });
}

function itemPrimaryLabel(item: AchievementItem) {
  if (item.category === "idioma") {
    const language = normalizeText(item.language || item.title) || "Idioma";
    return item.level ? `${language} — ${item.level}` : language;
  }
  if (item.category === "certificacion") {
    return normalizeText(item.title) || "Certificación";
  }
  return normalizeText(item.title) || "Logro";
}

function toPayload(items: AchievementItem[]) {
  return items
    .map((item) => {
      if (item.category === "idioma") {
        const language = normalizeText(item.language || item.title);
        const level = normalizeText(item.level);
        return {
          title: language,
          language: language || null,
          level: level || null,
          certificate_title: normalizeText(item.certificate_title) || null,
          issuer: normalizeText(item.issuer) || null,
          date: normalizeText(item.date) || null,
          description: normalizeText(item.description) || null,
          category: "idioma" as const,
        };
      }

      return {
        title: normalizeText(item.title),
        language: null,
        level: null,
        certificate_title: item.category === "certificacion" ? normalizeText(item.certificate_title || item.title) || null : null,
        issuer: normalizeText(item.issuer) || null,
        date: normalizeText(item.date) || null,
        description: normalizeText(item.description) || null,
        category: item.category,
      };
    })
    .filter((item) => {
      if (item.category === "idioma") return Boolean(item.language);
      return Boolean(item.title || item.issuer || item.date || item.description);
    });
}

function buildNewItem(mode: EditorMode): AchievementItem {
  if (mode === "language") return { ...EMPTY_LANGUAGE };
  return { ...EMPTY_CERTIFICATION };
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

function TextAreaField({
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
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
      />
    </label>
  );
}

function LanguageForm({
  item,
  onChange,
}: {
  item: AchievementItem;
  onChange: (patch: Partial<AchievementItem>) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="Idioma" value={item.language} onChange={(value) => onChange({ language: value, title: value })} placeholder="Ej.: English" />
      <label className="block">
        <div className="text-sm font-semibold text-gray-900">Nivel</div>
        <select
          value={item.level}
          onChange={(e) => onChange({ level: e.target.value })}
          className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
        >
          <option value="">Selecciona nivel</option>
          {LANGUAGE_LEVEL_OPTIONS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </label>
      <Field
        label="Certificado asociado (opcional)"
        value={item.certificate_title}
        onChange={(value) => onChange({ certificate_title: value })}
        placeholder="Ej.: IELTS Academic"
      />
      <Field
        label="Entidad certificadora (opcional)"
        value={item.issuer}
        onChange={(value) => onChange({ issuer: value })}
        placeholder="Ej.: Cambridge"
      />
      <Field label="Año / fecha (opcional)" value={item.date} onChange={(value) => onChange({ date: value })} placeholder="YYYY o YYYY-MM" />
      <TextAreaField
        label="Observaciones (opcional)"
        value={item.description}
        onChange={(value) => onChange({ description: value })}
        placeholder="Ej.: uso profesional diario, experiencia en atención al cliente, etc."
      />
    </div>
  );
}

function CertificationForm({
  item,
  onChange,
}: {
  item: AchievementItem;
  onChange: (patch: Partial<AchievementItem>) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="Título de la certificación" value={item.title} onChange={(value) => onChange({ title: value, certificate_title: value })} />
      <Field label="Entidad emisora" value={item.issuer} onChange={(value) => onChange({ issuer: value })} />
      <Field label="Fecha / año" value={item.date} onChange={(value) => onChange({ date: value })} placeholder="YYYY o YYYY-MM" />
      <Field label="URL o referencia (opcional)" value={item.certificate_title} onChange={(value) => onChange({ certificate_title: value })} placeholder="Código, referencia o enlace" />
      <div className="md:col-span-2">
        <TextAreaField
          label="Descripción opcional"
          value={item.description}
          onChange={(value) => onChange({ description: value })}
          placeholder="Contexto, especialidad o alcance de la certificación."
        />
      </div>
    </div>
  );
}

function EditorCard({
  title,
  subtitle,
  item,
  mode,
  onChange,
  onRemove,
}: {
  title: string;
  subtitle: string;
  item: AchievementItem;
  mode: EditorMode;
  onChange: (patch: Partial<AchievementItem>) => void;
  onRemove: () => void;
}) {
  return (
    <article className="rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
        >
          Eliminar
        </button>
      </div>
      <div className="mt-4">
        {mode === "language" ? <LanguageForm item={item} onChange={onChange} /> : null}
        {mode === "certification" ? <CertificationForm item={item} onChange={onChange} /> : null}
      </div>
    </article>
  );
}

export default function CandidateAchievementsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<AchievementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [supportsCertifications, setSupportsCertifications] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/candidate/profile", { credentials: "include", cache: "no-store" as any });
      const j = await r.json().catch(() => ({}));
      setItems(normalizeAchievements(j?.profile?.achievements_catalog?.all || j?.profile?.achievements || j?.profile?.certifications));
      setSupportsCertifications(Boolean(j?.profile?.achievements_support?.certifications));
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (loading) return;
    const open = String(searchParams.get("open") || "").toLowerCase();
    if (!open) return;
    if (open === "language" && items.some((item) => item.category === "idioma" && !item.language && !item.level && !item.description)) return;
    if (open === "certification" && items.some((item) => item.category === "certificacion" && !item.title && !item.issuer && !item.description)) return;
    if (open === "language") add("language");
    if (open === "certification" && supportsCertifications) add("certification");
    window.history.replaceState({}, "", pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, pathname, router, searchParams, supportsCertifications]);

  const languages = useMemo(() => items.filter((item) => item.category === "idioma"), [items]);
  const certifications = useMemo(() => items.filter((item) => item.category === "certificacion"), [items]);
  function update(index: number, patch: Partial<AchievementItem>) {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
    setMessage(null);
  }

  function add(mode: EditorMode) {
    setItems((prev) => [...prev, buildNewItem(mode)]);
    setMessage(null);
  }

  function remove(index: number) {
    const ok = window.confirm("¿Seguro que quieres eliminar este registro?");
    if (!ok) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
    setMessage(null);
  }

  async function save() {
    setSaving(true);
    setMessage(null);

    const r = await fetch("/api/candidate/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        languages: toPayload(items.filter((item) => item.category === "idioma")),
        certifications: supportsCertifications
          ? toPayload(items.filter((item) => item.category === "certificacion"))
          : [],
      }),
    });

    const j = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) {
      setMessage(toUiSaveError(j?.details || j?.error));
      return;
    }

    setItems(normalizeAchievements(j?.profile?.achievements_catalog?.all || j?.profile?.achievements || j?.profile?.certifications));
    setSupportsCertifications(Boolean(j?.profile?.achievements_support?.certifications));
    router.replace(`${pathname}?saved=1`, { scroll: false });
    setMessage(supportsCertifications ? "Idiomas y certificaciones guardados correctamente." : "Idiomas guardados correctamente.");
  }

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-gray-200 bg-white p-5">
        <h1 className="text-2xl font-semibold text-gray-900">Idiomas y certificaciones</h1>
        <p className="mt-2 text-sm text-gray-600">
          Gestiona las señales profesionales que hoy sí están soportadas por tu perfil.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Los idiomas se guardan en tu perfil general y las certificaciones se mantienen separadas cuando están disponibles.
        </p>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className={`grid gap-3 ${supportsCertifications ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Idiomas</div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">{languages.length}</div>
            <p className="mt-2 text-sm text-gray-600">Añade idioma y nivel como señal laboral clara.</p>
            <button
              type="button"
              onClick={() => add("language")}
              className="mt-4 inline-flex rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            >
              Añadir idioma
            </button>
          </div>
          {supportsCertifications ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Certificaciones</div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">{certifications.length}</div>
            <p className="mt-2 text-sm text-gray-600">Gestiona certificados con su emisor y fecha propia.</p>
            <button
              type="button"
              onClick={() => add("certification")}
              className="mt-4 inline-flex rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            >
              Añadir certificación
            </button>
          </div>
          ) : null}
        </div>

        {loading ? <p className="mt-4 text-sm text-gray-600">Cargando…</p> : null}

        {!loading && items.length === 0 ? (
          <p className="mt-4 text-sm text-gray-600">Todavía no has añadido idiomas{supportsCertifications ? " o certificaciones" : ""}.</p>
        ) : null}

        <div className="mt-6 space-y-6">
          <section>
            <div className="mb-3">
              <h2 className="text-base font-semibold text-gray-900">Idiomas</h2>
              <p className="text-sm text-gray-600">Cada idioma se registra con su nivel, y opcionalmente con certificado y entidad emisora.</p>
            </div>
            <div className="space-y-3">
              {languages.map((item) => {
                const index = items.indexOf(item);
                return (
                  <EditorCard
                    key={`language-${index}`}
                    title={itemPrimaryLabel(item)}
                    subtitle="Idioma y nivel"
                    item={item}
                    mode="language"
                    onChange={(patch) => update(index, patch)}
                    onRemove={() => remove(index)}
                  />
                );
              })}
              {!languages.length ? <p className="text-sm text-gray-500">Aún no has añadido idiomas.</p> : null}
            </div>
          </section>

          {supportsCertifications ? (
          <section>
            <div className="mb-3">
              <h2 className="text-base font-semibold text-gray-900">Certificaciones</h2>
              <p className="text-sm text-gray-600">Las certificaciones se guardan con título, entidad emisora y fecha propia.</p>
            </div>
            <div className="space-y-3">
              {certifications.map((item) => {
                const index = items.indexOf(item);
                return (
                  <EditorCard
                    key={`certification-${index}`}
                    title={itemPrimaryLabel(item)}
                    subtitle="Certificación"
                    item={item}
                    mode="certification"
                    onChange={(patch) => update(index, patch)}
                    onRemove={() => remove(index)}
                  />
                );
              })}
              {!certifications.length ? <p className="text-sm text-gray-500">Aún no has añadido certificaciones.</p> : null}
            </div>
          </section>
          ) : (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h2 className="text-base font-semibold text-amber-900">Logros adicionales no disponibles</h2>
              <p className="mt-1 text-sm text-amber-800">
                Tu perfil actual permite guardar idiomas{supportsCertifications ? " y certificaciones" : ""}. Los otros logros no se guardan todavía en la base de datos activa.
              </p>
            </section>
          )}
        </div>

        <div className="mt-6 flex items-center gap-3">
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
