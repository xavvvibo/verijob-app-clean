"use client";

import { useMemo, useState } from "react";
import { z } from "zod";
import { createClient } from "@/utils/supabase/client";
import CvUploadAndParse from "./CvUploadAndParse";

const ProfileSchema = z.object({
  full_name: z.string().max(160).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
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
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
};

export default function ProfileSettingsClient({ initialProfile }: { initialProfile: Profile }) {
  const supabase = useMemo(() => createClient(), []);
  const [p, setP] = useState<Profile>(initialProfile);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [email, setEmail] = useState(p.email ?? "");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);

  async function saveProfile() {
    setSaveMsg(null);
    setSaving(true);
    try {
      const data = ProfileSchema.parse({
        full_name: p.full_name,
        phone: p.phone,
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
      setSaveMsg("Guardado.");
    } catch (e: any) {
      setSaveMsg(e?.message || "Error guardando perfil.");
    } finally {
      setSaving(false);
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

      // Normal: Supabase suele requerir confirmación del nuevo email.
      setEmailMsg("Solicitud enviada. Revisa tu email para confirmar el cambio.");
    } catch (e: any) {
      setEmailMsg(e?.message || "Error cambiando email.");
    } finally {
      setEmailSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Datos personales */}
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
          <Field label="Teléfono" value={p.phone ?? ""} onChange={(v) => setP({ ...p, phone: v || null })} />
          <Field label="Dirección (línea 1)" value={p.address_line1 ?? ""} onChange={(v) => setP({ ...p, address_line1: v || null })} />
          <Field label="Dirección (línea 2)" value={p.address_line2 ?? ""} onChange={(v) => setP({ ...p, address_line2: v || null })} />
          <Field label="Ciudad" value={p.city ?? ""} onChange={(v) => setP({ ...p, city: v || null })} />
          <Field label="Provincia/Región" value={p.region ?? ""} onChange={(v) => setP({ ...p, region: v || null })} />
          <Field label="Código postal" value={p.postal_code ?? ""} onChange={(v) => setP({ ...p, postal_code: v || null })} />
          <Field label="País" value={p.country ?? ""} onChange={(v) => setP({ ...p, country: v || null })} />
        </div>

        {saveMsg && <p className="mt-3 text-sm text-slate-600">{saveMsg}</p>}
      </section>

      {/* Cuenta */}
      <section className="rounded-xl border bg-white p-5">
        <h2 className="font-semibold">Cuenta</h2>
        <p className="mt-1 text-sm text-slate-600">Puedes solicitar el cambio de email (requiere confirmación).</p>

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

      {/* Datos laborales/académicos */}
      <section className="rounded-xl border bg-white p-5">
        <h2 className="font-semibold">Datos laborales / académicos</h2>
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
