"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useEffect, useState } from "react";

type LanguageItem = {
  id?: string;
  language_name: string;
  proficiency_level: string;
  is_native: boolean;
  notes: string;
};

type CertificationItem = {
  id?: string;
  name: string;
  issuer: string;
  issue_date: string;
  expiry_date: string;
  credential_id: string;
  credential_url: string;
  notes: string;
};

type AchievementItem = {
  id?: string;
  title: string;
  description: string;
  achievement_type: string;
  issuer: string;
  achieved_at: string;
};

const EMPTY_LANGUAGE: LanguageItem = {
  language_name: "",
  proficiency_level: "",
  is_native: false,
  notes: "",
};

const EMPTY_CERTIFICATION: CertificationItem = {
  name: "",
  issuer: "",
  issue_date: "",
  expiry_date: "",
  credential_id: "",
  credential_url: "",
  notes: "",
};

const EMPTY_ACHIEVEMENT: AchievementItem = {
  title: "",
  description: "",
  achievement_type: "",
  issuer: "",
  achieved_at: "",
};

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeLanguages(raw: any): LanguageItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any) => ({
    id: item?.id ? String(item.id) : undefined,
    language_name: normalizeText(item?.language_name),
    proficiency_level: normalizeText(item?.proficiency_level),
    is_native: Boolean(item?.is_native),
    notes: normalizeText(item?.notes),
  }));
}

function normalizeCertifications(raw: any): CertificationItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any) => ({
    id: item?.id ? String(item.id) : undefined,
    name: normalizeText(item?.name),
    issuer: normalizeText(item?.issuer),
    issue_date: normalizeText(item?.issue_date),
    expiry_date: normalizeText(item?.expiry_date),
    credential_id: normalizeText(item?.credential_id),
    credential_url: normalizeText(item?.credential_url),
    notes: normalizeText(item?.notes),
  }));
}

function normalizeAchievements(raw: any): AchievementItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any) => ({
    id: item?.id ? String(item.id) : undefined,
    title: normalizeText(item?.title),
    description: normalizeText(item?.description),
    achievement_type: normalizeText(item?.achievement_type),
    issuer: normalizeText(item?.issuer),
    achieved_at: normalizeText(item?.achieved_at),
  }));
}

function cleanLanguages(items: LanguageItem[]) {
  return items
    .map((item) => ({
      language_name: normalizeText(item.language_name),
      proficiency_level: normalizeText(item.proficiency_level) || null,
      is_native: Boolean(item.is_native),
      notes: normalizeText(item.notes) || null,
    }))
    .filter((item) => item.language_name);
}

function cleanCertifications(items: CertificationItem[]) {
  return items
    .map((item) => ({
      name: normalizeText(item.name),
      issuer: normalizeText(item.issuer) || null,
      issue_date: normalizeText(item.issue_date) || null,
      expiry_date: normalizeText(item.expiry_date) || null,
      credential_id: normalizeText(item.credential_id) || null,
      credential_url: normalizeText(item.credential_url) || null,
      notes: normalizeText(item.notes) || null,
    }))
    .filter((item) => item.name || item.issuer || item.notes);
}

function cleanAchievements(items: AchievementItem[]) {
  return items
    .map((item) => ({
      title: normalizeText(item.title),
      description: normalizeText(item.description) || null,
      achievement_type: normalizeText(item.achievement_type) || null,
      issuer: normalizeText(item.issuer) || null,
      achieved_at: normalizeText(item.achieved_at) || null,
    }))
    .filter((item) => item.title || item.description || item.issuer);
}

function toUiError(message: unknown) {
  const raw = normalizeText(message);
  if (!raw) return "No se pudieron guardar los cambios.";
  return "No se pudieron guardar los idiomas, certificaciones o logros. Revisa los datos y vuelve a intentarlo.";
}

export default function CandidateAchievementsPage() {
  const [languages, setLanguages] = useState<LanguageItem[]>([]);
  const [certifications, setCertifications] = useState<CertificationItem[]>([]);
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [supportsLanguages, setSupportsLanguages] = useState(false);
  const [supportsCertifications, setSupportsCertifications] = useState(false);
  const [supportsAchievements, setSupportsAchievements] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [languagesRes, certificationsRes, achievementsRes] = await Promise.all([
        fetch("/api/candidate/languages", { credentials: "include", cache: "no-store" as any }),
        fetch("/api/candidate/certifications", { credentials: "include", cache: "no-store" as any }),
        fetch("/api/candidate/achievements", { credentials: "include", cache: "no-store" as any }),
      ]);
      const [languagesJson, certificationsJson, achievementsJson] = await Promise.all([
        languagesRes.json().catch(() => ({})),
        certificationsRes.json().catch(() => ({})),
        achievementsRes.json().catch(() => ({})),
      ]);
      setLanguages(normalizeLanguages(languagesJson?.items));
      setCertifications(normalizeCertifications(certificationsJson?.items));
      setAchievements(normalizeAchievements(achievementsJson?.items));
      setSupportsLanguages(Boolean(languagesJson?.support));
      setSupportsCertifications(Boolean(certificationsJson?.support));
      setSupportsAchievements(Boolean(achievementsJson?.support));
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    const [languagesRes, certificationsRes, achievementsRes] = await Promise.all([
      supportsLanguages
        ? fetch("/api/candidate/languages", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ items: cleanLanguages(languages) }),
          })
        : Promise.resolve(new Response(JSON.stringify({ ok: true, items: [] }), { status: 200 })),
      supportsCertifications
        ? fetch("/api/candidate/certifications", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ items: cleanCertifications(certifications) }),
          })
        : Promise.resolve(new Response(JSON.stringify({ ok: true, items: [] }), { status: 200 })),
      supportsAchievements
        ? fetch("/api/candidate/achievements", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ items: cleanAchievements(achievements) }),
          })
        : Promise.resolve(new Response(JSON.stringify({ ok: true, items: [] }), { status: 200 })),
    ]);
    const [languagesJson, certificationsJson, achievementsJson] = await Promise.all([
      languagesRes.json().catch(() => ({})),
      certificationsRes.json().catch(() => ({})),
      achievementsRes.json().catch(() => ({})),
    ]);
    setSaving(false);

    if (!languagesRes.ok || !certificationsRes.ok || !achievementsRes.ok) {
      setMessage(
        toUiError(
          languagesJson?.details ||
            certificationsJson?.details ||
            achievementsJson?.details ||
            languagesJson?.error ||
            certificationsJson?.error ||
            achievementsJson?.error,
        ),
      );
      return;
    }

    setLanguages(normalizeLanguages(languagesJson?.items));
    setCertifications(normalizeCertifications(certificationsJson?.items));
    setAchievements(normalizeAchievements(achievementsJson?.items));
    setMessage("Idiomas, certificaciones y logros guardados correctamente.");
  }

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-gray-200 bg-white p-5">
        <h1 className="text-2xl font-semibold text-gray-900">Idiomas, certificaciones y logros</h1>
        <p className="mt-2 text-sm text-gray-600">
          Mantén tus señales profesionales separadas y listas para mostrarse en tu perfil.
        </p>
      </header>

      {loading ? <section className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600">Cargando…</section> : null}

      {!loading ? (
        <>
          <CollectionSection
            title="Idiomas"
            description="Añade los idiomas que utilizas y el nivel con el que puedes trabajar."
            empty="Todavía no has añadido idiomas."
            supported={supportsLanguages}
            unsupportedMessage="Este entorno todavía no tiene activado el almacenamiento relacional de idiomas."
            onAdd={() => setLanguages((prev) => [...prev, { ...EMPTY_LANGUAGE }])}
            items={languages}
            renderItem={(item, index) => (
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Idioma" value={item.language_name} onChange={(value) => updateAt(setLanguages, index, { language_name: value })} />
                <Field label="Nivel" value={item.proficiency_level} onChange={(value) => updateAt(setLanguages, index, { proficiency_level: value })} />
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={item.is_native}
                    onChange={(e) => updateAt(setLanguages, index, { is_native: e.target.checked })}
                  />
                  Idioma nativo
                </label>
                <TextAreaField label="Notas" value={item.notes} onChange={(value) => updateAt(setLanguages, index, { notes: value })} />
                <div className="md:col-span-2 flex justify-end">
                  <RemoveButton onClick={() => removeAt(setLanguages, index)} />
                </div>
              </div>
            )}
          />

          <CollectionSection
            title="Certificaciones"
            description="Registra certificados con emisor, fecha y referencia cuando la tengas."
            empty="Todavía no has añadido certificaciones."
            supported={supportsCertifications}
            unsupportedMessage="Este entorno todavía no tiene activado el almacenamiento relacional de certificaciones."
            onAdd={() => setCertifications((prev) => [...prev, { ...EMPTY_CERTIFICATION }])}
            items={certifications}
            renderItem={(item, index) => (
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Nombre" value={item.name} onChange={(value) => updateAt(setCertifications, index, { name: value })} />
                <Field label="Emisor" value={item.issuer} onChange={(value) => updateAt(setCertifications, index, { issuer: value })} />
                <Field label="Fecha de emisión" value={item.issue_date} onChange={(value) => updateAt(setCertifications, index, { issue_date: value })} placeholder="YYYY-MM" />
                <Field label="Caducidad" value={item.expiry_date} onChange={(value) => updateAt(setCertifications, index, { expiry_date: value })} placeholder="YYYY-MM" />
                <Field label="Credencial / código" value={item.credential_id} onChange={(value) => updateAt(setCertifications, index, { credential_id: value })} />
                <Field label="URL credencial" value={item.credential_url} onChange={(value) => updateAt(setCertifications, index, { credential_url: value })} />
                <div className="md:col-span-2">
                  <TextAreaField label="Notas" value={item.notes} onChange={(value) => updateAt(setCertifications, index, { notes: value })} />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <RemoveButton onClick={() => removeAt(setCertifications, index)} />
                </div>
              </div>
            )}
          />

          <CollectionSection
            title="Logros"
            description="Usa este bloque para premios, reconocimientos o hitos profesionales."
            empty="Todavía no has añadido logros."
            supported={supportsAchievements}
            unsupportedMessage="Este entorno todavía no tiene activado el almacenamiento relacional de logros."
            onAdd={() => setAchievements((prev) => [...prev, { ...EMPTY_ACHIEVEMENT }])}
            items={achievements}
            renderItem={(item, index) => (
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Título" value={item.title} onChange={(value) => updateAt(setAchievements, index, { title: value })} />
                <Field label="Tipo" value={item.achievement_type} onChange={(value) => updateAt(setAchievements, index, { achievement_type: value })} placeholder="Premio, reconocimiento, hito…" />
                <Field label="Emisor" value={item.issuer} onChange={(value) => updateAt(setAchievements, index, { issuer: value })} />
                <Field label="Fecha" value={item.achieved_at} onChange={(value) => updateAt(setAchievements, index, { achieved_at: value })} placeholder="YYYY-MM" />
                <div className="md:col-span-2">
                  <TextAreaField label="Descripción" value={item.description} onChange={(value) => updateAt(setAchievements, index, { description: value })} />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <RemoveButton onClick={() => removeAt(setAchievements, index)} />
                </div>
              </div>
            )}
          />

          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-3">
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
        </>
      ) : null}
    </div>
  );
}

function updateAt<T>(setter: Dispatch<SetStateAction<T[]>>, index: number, patch: Partial<T>) {
  setter((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
}

function removeAt<T>(setter: Dispatch<SetStateAction<T[]>>, index: number) {
  setter((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
}

function CollectionSection<T>({
  title,
  description,
  empty,
  supported,
  unsupportedMessage,
  onAdd,
  items,
  renderItem,
}: {
  title: string;
  description: string;
  empty: string;
  supported: boolean;
  unsupportedMessage: string;
  onAdd: () => void;
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <p className="mt-1 text-sm text-gray-600">{description}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={!supported}
          className="inline-flex rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
        >
          Añadir
        </button>
      </div>

      {!supported ? <p className="mt-4 text-sm text-gray-600">{unsupportedMessage}</p> : null}
      {supported && items.length === 0 ? <p className="mt-4 text-sm text-gray-600">{empty}</p> : null}

      {supported && items.length > 0 ? (
        <div className="mt-4 space-y-4">
          {items.map((item, index) => (
            <article key={index} className="rounded-xl border border-gray-200 p-4">
              {renderItem(item, index)}
            </article>
          ))}
        </div>
      ) : null}
    </section>
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

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <div className="text-sm font-semibold text-gray-900">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
      />
    </label>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
    >
      Eliminar
    </button>
  );
}
