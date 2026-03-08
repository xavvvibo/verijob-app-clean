"use client";

import { useMemo, useState } from "react";
import { z } from "zod";
import { createClient } from "@/utils/supabase/client";

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

export default function CandidateProfileIdentityClient({ initialProfile }: { initialProfile: Profile }) {
  const supabase = useMemo(() => createClient(), []);
  const [p, setP] = useState<Profile>(initialProfile);
  const [email, setEmail] = useState(initialProfile.email ?? "");
  const [saving, setSaving] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function saveProfile() {
    setSaving(true);
    setMessage(null);
    try {
      const payload = ProfileSchema.parse({
        full_name: p.full_name,
        phone: p.phone,
        title: p.title,
        location: p.location,
        address_line1: p.address_line1,
        address_line2: p.address_line2,
        city: p.city,
        region: p.region,
        postal_code: p.postal_code,
        country: p.country,
      });

      const { error } = await supabase.from("profiles").update(payload).eq("id", p.id);
      if (error) throw new Error(error.message);
      setMessage("Perfil guardado correctamente.");
    } catch (e: any) {
      setMessage(e?.message || "No se pudo guardar el perfil.");
    } finally {
      setSaving(false);
    }
  }

  async function changeEmail() {
    setEmailSaving(true);
    setMessage(null);
    try {
      const next = email.trim();
      if (!next || !next.includes("@")) throw new Error("Email inválido");
      const { error } = await supabase.auth.updateUser({ email: next });
      if (error) throw new Error(error.message);
      setMessage("Solicitud enviada. Revisa tu email para confirmar el cambio.");
    } catch (e: any) {
      setMessage(e?.message || "No se pudo cambiar el email.");
    } finally {
      setEmailSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Datos de identidad</h2>
          <button
            type="button"
            onClick={saveProfile}
            disabled={saving}
            className="inline-flex rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Nombre completo" value={p.full_name ?? ""} onChange={(v) => setP({ ...p, full_name: v || null })} />
          <Field label="Título profesional" value={p.title ?? ""} onChange={(v) => setP({ ...p, title: v || null })} />
          <Field label="Teléfono" value={p.phone ?? ""} onChange={(v) => setP({ ...p, phone: v || null })} />
          <Field label="Ubicación visible" value={p.location ?? ""} onChange={(v) => setP({ ...p, location: v || null })} />
          <Field label="Dirección (línea 1)" value={p.address_line1 ?? ""} onChange={(v) => setP({ ...p, address_line1: v || null })} />
          <Field label="Dirección (línea 2)" value={p.address_line2 ?? ""} onChange={(v) => setP({ ...p, address_line2: v || null })} />
          <Field label="Ciudad" value={p.city ?? ""} onChange={(v) => setP({ ...p, city: v || null })} />
          <Field label="Provincia / región" value={p.region ?? ""} onChange={(v) => setP({ ...p, region: v || null })} />
          <Field label="Código postal" value={p.postal_code ?? ""} onChange={(v) => setP({ ...p, postal_code: v || null })} />
          <Field label="País" value={p.country ?? ""} onChange={(v) => setP({ ...p, country: v || null })} />
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Cuenta</h2>
        <p className="mt-1 text-sm text-gray-600">Puedes solicitar cambio de email de acceso.</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Email" value={email} onChange={setEmail} />
          <button
            type="button"
            onClick={changeEmail}
            disabled={emailSaving}
            className="inline-flex rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60"
          >
            {emailSaving ? "Enviando…" : "Cambiar email"}
          </button>
        </div>
      </section>

      {message ? <p className="text-sm text-gray-600">{message}</p> : null}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block w-full">
      <div className="text-sm font-semibold text-gray-900">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
      />
    </label>
  );
}
