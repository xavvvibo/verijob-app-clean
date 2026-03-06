"use client";

import { useMemo, useState, useEffect } from "react";
import { z } from "zod";
import { createClient } from "@/utils/supabase/client";
import CvUploadAndParse from "./CvUploadAndParse";

const ProfileSchema = z.object({
  full_name: z.string().max(160).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  title: z.string().max(160).nullable().optional(),
  location: z.string().max(160).nullable().optional(),
  address_line1: z.string().max(160).nullable().optional(),
  address_line2: z.string().max(160).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  region: z.string().max(120).nullable().optional(),
  postal_code: z.string().max(40).nullable().optional(),
  country: z.string().max(80).nullable().optional(),
});

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  title: string | null;
  location: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
};

type EducationItem = {
  title: string;
  institution: string;
  start_date: string;
  end_date: string;
  description: string;
};

type CertificationItem = {
  title: string;
  issuer: string;
  date: string;
  description: string;
};

type CandidateProfileState = {
  summary: string;
  education: EducationItem[];
  certifications: CertificationItem[];
};

const EMPTY_EDUCATION: EducationItem = {
  title: "",
  institution: "",
  start_date: "",
  end_date: "",
  description: "",
};

const EMPTY_CERT: CertificationItem = {
  title: "",
  issuer: "",
  date: "",
  description: "",
};

function normalizeEducation(raw: any): EducationItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x: any) => ({
    title: x?.title ?? x?.degree ?? x?.name ?? "",
    institution: x?.institution ?? x?.school ?? x?.center ?? "",
    start_date: x?.start_date ?? x?.start ?? "",
    end_date: x?.end_date ?? x?.end ?? "",
    description: x?.description ?? x?.notes ?? "",
  }));
}

function normalizeCertifications(raw: any): CertificationItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x: any) => ({
    title: x?.title ?? x?.name ?? "",
    issuer: x?.issuer ?? x?.entity ?? x?.organization ?? "",
    date: x?.date ?? x?.issued_at ?? x?.year ?? "",
    description: x?.description ?? x?.notes ?? "",
  }));
}

function cleanEducation(items: EducationItem[]) {
  return items
    .map((x) => ({
      title: x.title.trim(),
      institution: x.institution.trim(),
      start_date: x.start_date.trim() || null,
      end_date: x.end_date.trim() || null,
      description: x.description.trim() || null,
    }))
    .filter((x) => x.title || x.institution || x.start_date || x.end_date || x.description);
}

function cleanCertifications(items: CertificationItem[]) {
  return items
    .map((x) => ({
      title: x.title.trim(),
      issuer: x.issuer.trim() || null,
      date: x.date.trim() || null,
      description: x.description.trim() || null,
    }))
    .filter((x) => x.title || x.issuer || x.date || x.description);
}

function joinLocation(parts: Array<string | null | undefined>) {
  return parts.map((x) => (x || "").trim()).filter(Boolean).join(", ") || null;
}

export default function ProfileSettingsClient({ initialProfile }: { initialProfile: Profile }) {
  const supabase = useMemo(() => createClient(), []);
  const [p, setP] = useState<Profile>(initialProfile);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [email, setEmail] = useState(p.email ?? "");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);

  const [candidateProfile, setCandidateProfile] = useState<CandidateProfileState>({
    summary: "",
    education: [],
    certifications: [],
  });
  const [cpLoading, setCpLoading] = useState(true);
  const [cpSaving, setCpSaving] = useState(false);
  const [cpMsg, setCpMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await fetch("/api/candidate/profile", { credentials: "include" });
        const data = await res.json().catch(() => ({}));

        if (!alive) return;

        setCandidateProfile({
          summary: typeof data?.profile?.summary === "string" ? data.profile.summary : "",
          education: normalizeEducation(data?.profile?.education),
          certifications: normalizeCertifications(data?.profile?.certifications),
        });
      } catch {
      } finally {
        if (alive) setCpLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function saveProfile() {
    setSaveMsg(null);
    setSaving(true);
    try {
      const derivedLocation =
        (p.location || "").trim() ||
        joinLocation([p.city, p.region, p.country]);

      const data = ProfileSchema.parse({
        full_name: p.full_name,
        phone: p.phone,
        title: p.title,
        location: derivedLocation,
        address_line1: p.address_line1,
        address_line2: p.address_line2,
        city: p.city,
        region: p.region,
        postal_code: p.postal_code,
        country: p.country,
      });

      const { error } = await supabase
        .from("profiles")
        .update(data)
        .eq("id", p.id);

      if (error) throw new Error(error.message);

      setP((prev) => ({ ...prev, location: derivedLocation }));
      setSaveMsg("Datos personales guardados.");
    } catch (e: any) {
      setSaveMsg(e?.message || "Error guardando perfil.");
    } finally {
      setSaving(false);
    }
  }

  async function saveCandidateProfile() {
    setCpMsg(null);
    setCpSaving(true);
    try {
      const res = await fetch("/api/candidate/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          summary: candidateProfile.summary.trim() || null,
          education: cleanEducation(candidateProfile.education),
          certifications: cleanCertifications(candidateProfile.certifications),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Error guardando perfil profesional.");
      }

      setCandidateProfile({
        summary: typeof data?.profile?.summary === "string" ? data.profile.summary : "",
        education: normalizeEducation(data?.profile?.education),
        certifications: normalizeCertifications(data?.profile?.certifications),
      });

      setCpMsg("Perfil profesional guardado.");
    } catch (e: any) {
      setCpMsg(e?.message || "Error guardando perfil profesional.");
    } finally {
      setCpSaving(false);
    }
  }

  async function changeEmail() {
    setEmailMsg(null);
    setEmailSaving(true);
    try {
      const next = (email || "").trim();
      if (!next || !next.includes("@")) throw new Error("Email inválido.");

      const { error } = await supabase.auth.updateUser({ email: next });
      if (error) throw new Error(error.message);

      setEmailMsg("Solicitud enviada. Revisa tu email para confirmar el cambio.");
    } catch (e: any) {
      setEmailMsg(e?.message || "Error cambiando email.");
    } finally {
      setEmailSaving(false);
    }
  }

  function updateEducation(idx: number, field: keyof EducationItem, value: string) {
    setCandidateProfile((prev) => {
      const next = [...prev.education];
      next[idx] = { ...next[idx], [field]: value };
      return { ...prev, education: next };
    });
  }

  function addEducation() {
    setCandidateProfile((prev) => ({
      ...prev,
      education: [...prev.education, { ...EMPTY_EDUCATION }],
    }));
  }

  function removeEducation(idx: number) {
    setCandidateProfile((prev) => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== idx),
    }));
  }

  function updateCertification(idx: number, field: keyof CertificationItem, value: string) {
    setCandidateProfile((prev) => {
      const next = [...prev.certifications];
      next[idx] = { ...next[idx], [field]: value };
      return { ...prev, certifications: next };
    });
  }

  function addCertification() {
    setCandidateProfile((prev) => ({
      ...prev,
      certifications: [...prev.certifications, { ...EMPTY_CERT }],
    }));
  }

  function removeCertification(idx: number) {
    setCandidateProfile((prev) => ({
      ...prev,
      certifications: prev.certifications.filter((_, i) => i !== idx),
    }));
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Datos personales</h2>
          <button
            onClick={saveProfile}
            disabled={saving}
            className="rounded-lg px-3 py-2 text-sm font-medium border bg-slate-900 text-white disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nombre completo" value={p.full_name ?? ""} onChange={(v) => setP({ ...p, full_name: v || null })} />
          <Field label="Título profesional" value={p.title ?? ""} onChange={(v) => setP({ ...p, title: v || null })} />
          <Field label="Teléfono" value={p.phone ?? ""} onChange={(v) => setP({ ...p, phone: v || null })} />
          <Field label="Ubicación visible" value={p.location ?? ""} onChange={(v) => setP({ ...p, location: v || null })} />
          <Field label="Dirección (línea 1)" value={p.address_line1 ?? ""} onChange={(v) => setP({ ...p, address_line1: v || null })} />
          <Field label="Dirección (línea 2)" value={p.address_line2 ?? ""} onChange={(v) => setP({ ...p, address_line2: v || null })} />
          <Field label="Ciudad" value={p.city ?? ""} onChange={(v) => setP({ ...p, city: v || null })} />
          <Field label="Provincia/Región" value={p.region ?? ""} onChange={(v) => setP({ ...p, region: v || null })} />
          <Field label="Código postal" value={p.postal_code ?? ""} onChange={(v) => setP({ ...p, postal_code: v || null })} />
          <Field label="País" value={p.country ?? ""} onChange={(v) => setP({ ...p, country: v || null })} />
        </div>

        {saveMsg && <p className="mt-3 text-sm text-slate-600">{saveMsg}</p>}
      </section>

      <section className="rounded-xl border bg-white p-5">
        <h2 className="font-semibold">Cuenta</h2>
        <p className="mt-1 text-sm text-slate-600">Puedes solicitar el cambio de email.</p>

        <div className="mt-4 flex flex-col md:flex-row gap-3 items-start md:items-end">
          <div className="w-full md:max-w-md">
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="tu@email.com"
            />
          </div>
          <button
            onClick={changeEmail}
            disabled={emailSaving}
            className="rounded-lg px-3 py-2 text-sm font-medium border bg-white disabled:opacity-50"
          >
            {emailSaving ? "Enviando..." : "Cambiar email"}
          </button>
        </div>

        {emailMsg && <p className="mt-3 text-sm text-slate-600">{emailMsg}</p>}
      </section>

      <section className="rounded-xl border bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Perfil profesional</h2>
            <p className="mt-1 text-sm text-slate-600">
              Edita tu resumen, formación y otros logros para alimentar el dashboard candidato.
            </p>
          </div>
          <button
            onClick={saveCandidateProfile}
            disabled={cpSaving || cpLoading}
            className="rounded-lg px-3 py-2 text-sm font-medium border bg-slate-900 text-white disabled:opacity-50"
          >
            {cpSaving ? "Guardando..." : "Guardar perfil profesional"}
          </button>
        </div>

        <div className="mt-5">
          <label className="block text-sm font-medium text-slate-700">Resumen profesional</label>
          <textarea
            value={candidateProfile.summary}
            onChange={(e) => setCandidateProfile((prev) => ({ ...prev, summary: e.target.value }))}
            rows={5}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Resume tu perfil, experiencia y propuesta profesional."
          />
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-medium">Datos académicos</h3>
              <p className="text-sm text-slate-600">Titulaciones, estudios, cursos o especializaciones.</p>
            </div>
            <button
              type="button"
              onClick={addEducation}
              className="rounded-lg px-3 py-2 text-sm font-medium border bg-white"
            >
              Añadir formación
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {candidateProfile.education.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-slate-600">
                No has añadido formación todavía.
              </div>
            ) : (
              candidateProfile.education.map((item, idx) => (
                <div key={idx} className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Formación #{idx + 1}</div>
                    <button
                      type="button"
                      onClick={() => removeEducation(idx)}
                      className="rounded-lg px-3 py-2 text-sm font-medium border bg-white"
                    >
                      Eliminar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Título" value={item.title} onChange={(v) => updateEducation(idx, "title", v)} />
                    <Field label="Centro / institución" value={item.institution} onChange={(v) => updateEducation(idx, "institution", v)} />
                    <Field label="Fecha inicio" value={item.start_date} onChange={(v) => updateEducation(idx, "start_date", v)} />
                    <Field label="Fecha fin" value={item.end_date} onChange={(v) => updateEducation(idx, "end_date", v)} />
                  </div>

                  <TextAreaField
                    label="Descripción"
                    value={item.description}
                    onChange={(v) => updateEducation(idx, "description", v)}
                    rows={3}
                  />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-medium">Otros logros / certificaciones</h3>
              <p className="text-sm text-slate-600">Certificados, premios, hitos o acreditaciones complementarias.</p>
            </div>
            <button
              type="button"
              onClick={addCertification}
              className="rounded-lg px-3 py-2 text-sm font-medium border bg-white"
            >
              Añadir logro
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {candidateProfile.certifications.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-slate-600">
                No has añadido logros todavía.
              </div>
            ) : (
              candidateProfile.certifications.map((item, idx) => (
                <div key={idx} className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Logro #{idx + 1}</div>
                    <button
                      type="button"
                      onClick={() => removeCertification(idx)}
                      className="rounded-lg px-3 py-2 text-sm font-medium border bg-white"
                    >
                      Eliminar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Título" value={item.title} onChange={(v) => updateCertification(idx, "title", v)} />
                    <Field label="Emisor / entidad" value={item.issuer} onChange={(v) => updateCertification(idx, "issuer", v)} />
                    <Field label="Fecha" value={item.date} onChange={(v) => updateCertification(idx, "date", v)} />
                  </div>

                  <TextAreaField
                    label="Descripción"
                    value={item.description}
                    onChange={(v) => updateCertification(idx, "description", v)}
                    rows={3}
                  />
                </div>
              ))
            )}
          </div>
        </div>

        {cpMsg && <p className="mt-4 text-sm text-slate-600">{cpMsg}</p>}
      </section>

      <section className="rounded-xl border bg-white p-5">
        <h2 className="font-semibold">CV y extracción automática</h2>
        <p className="mt-1 text-sm text-slate-600">Sube tu CV para extraer experiencias automáticamente.</p>
        <div className="mt-4">
          <CvUploadAndParse />
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
      />
    </div>
  );
}
