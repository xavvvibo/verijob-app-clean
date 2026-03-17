"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { createClient } from "@/utils/supabase/client";
import InlineStatusMessage from "@/components/ui/InlineStatusMessage";
import { normalizeCandidatePhone } from "@/lib/phone";

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
  identity_type: string | null;
  identity_masked: string | null;
  has_identity: boolean;
};

const IDENTITY_TYPE_OPTIONS = [
  { value: "dni", label: "DNI" },
  { value: "nif", label: "NIE" },
  { value: "passport", label: "Pasaporte" },
];

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
  const [persistedIdentity, setPersistedIdentity] = useState({
    identity_type: initialProfile.identity_type,
    identity_masked: initialProfile.identity_masked,
    has_identity: initialProfile.has_identity,
  });
  const [email, setEmail] = useState(initialProfile.email ?? "");
  const [identityValue, setIdentityValue] = useState("");
  const [clearIdentityOnSave, setClearIdentityOnSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ tone: "success" | "warning" | "error"; text: string } | null>(null);
  const [accountMessage, setAccountMessage] = useState<{ tone: "success" | "warning" | "error"; text: string } | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const response = await fetch("/api/candidate/profile", {
          credentials: "include",
          cache: "no-store",
        });
        const result = await response.json().catch(() => ({}));
        if (!alive || !response.ok) return;
        const next = result?.personal_profile || {};
        setP((current) => ({
          ...current,
          full_name: next.full_name ?? current.full_name,
          phone: next.phone ?? current.phone,
          title: next.title ?? current.title,
          location: next.location ?? current.location,
          address_line1: next.address_line1 ?? current.address_line1,
          address_line2: next.address_line2 ?? current.address_line2,
          city: next.city ?? current.city,
          region: next.region ?? current.region,
          postal_code: next.postal_code ?? current.postal_code,
          country: next.country ?? current.country,
          identity_type: next.identity_type ?? current.identity_type,
          identity_masked: next.identity_masked ?? current.identity_masked,
          has_identity: next.has_identity ?? current.has_identity,
        }));
        setPersistedIdentity({
          identity_type: next.identity_type ?? null,
          identity_masked: next.identity_masked ?? null,
          has_identity: Boolean(next.has_identity),
        });
      } catch {}
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function saveProfile() {
    setSaving(true);
    setProfileMessage(null);
    try {
      const payload = ProfileSchema.parse({
        full_name: p.full_name,
        phone: p.phone,
        title: p.title,
        location: p.location,
        address_line1: undefined,
        address_line2: undefined,
        city: undefined,
        region: undefined,
        postal_code: undefined,
        country: undefined,
      });
      const normalizedPhone = normalizeCandidatePhone(payload.phone);
      if (normalizedPhone.ok === false) {
        throw new Error(normalizedPhone.error);
      }
      const requestBody: Record<string, unknown> = { ...payload };
      requestBody.phone = normalizedPhone.normalized;
      const identityRequested = clearIdentityOnSave || Boolean(identityValue.trim());
      const response = await fetch("/api/candidate/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const details = String(result?.details || "").trim();
        throw new Error(details ? `No se pudo guardar el perfil. ${details}` : "No se pudo guardar el perfil.");
      }
      const nextPersonalProfile = result?.personal_profile || {};
      setP((current) => ({
        ...current,
        full_name: nextPersonalProfile.full_name ?? current.full_name,
        phone: nextPersonalProfile.phone ?? current.phone,
        title: nextPersonalProfile.title ?? current.title,
        location: nextPersonalProfile.location ?? current.location,
        address_line1: null,
        address_line2: null,
        city: null,
        region: null,
        postal_code: null,
        country: null,
        identity_type: nextPersonalProfile.identity_type ?? current.identity_type,
        identity_masked: nextPersonalProfile.identity_masked ?? current.identity_masked,
        has_identity: nextPersonalProfile.has_identity ?? current.has_identity,
      }));
      setPersistedIdentity({
        identity_type: nextPersonalProfile.identity_type ?? null,
        identity_masked: nextPersonalProfile.identity_masked ?? null,
        has_identity: nextPersonalProfile.has_identity ?? false,
      });
      setIdentityValue("");
      setClearIdentityOnSave(false);
      if (identityRequested || result?.identity_ignored) {
        setP((current) => ({
          ...current,
          identity_type: null,
          identity_masked: null,
          has_identity: false,
        }));
        setProfileMessage({
          tone: "warning",
          text: "Perfil guardado correctamente. El documento de identidad no se persiste en este entorno.",
        });
      } else {
        setProfileMessage({ tone: "success", text: "Perfil guardado correctamente." });
      }
    } catch (e: any) {
      setProfileMessage({ tone: "error", text: e?.message || "No se pudo guardar el perfil." });
    } finally {
      setSaving(false);
    }
  }

  async function changeEmail() {
    setEmailSaving(true);
    setAccountMessage(null);
    try {
      const next = email.trim();
      if (!next || !next.includes("@")) throw new Error("Email inválido");
      const { error } = await supabase.auth.updateUser({ email: next });
      if (error) throw new Error(error.message);
      setAccountMessage({ tone: "success", text: "Solicitud enviada. Revisa tu email para confirmar el cambio." });
    } catch (e: any) {
      setAccountMessage({ tone: "error", text: e?.message || "No se pudo cambiar el email." });
    } finally {
      setEmailSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Datos personales</h2>
            <p className="mt-1 text-sm text-gray-600">
              El documento de identidad es opcional. Puedes guardar y usar tu perfil sin completarlo.
            </p>
          </div>
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
          <SelectField
            label="Tipo de documento"
            value={p.identity_type ?? "dni"}
            onChange={(v) => setP({ ...p, identity_type: v || null })}
            options={IDENTITY_TYPE_OPTIONS}
          />
          <label className="block w-full">
            <div className="text-sm font-semibold text-gray-900">Documento de identidad</div>
            <input
              value={identityValue}
              onChange={(e) => {
                setIdentityValue(e.target.value);
                if (clearIdentityOnSave) setClearIdentityOnSave(false);
              }}
              placeholder="Ej.: 12345678Z"
              autoComplete="off"
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
            <div className="mt-2 space-y-2 text-xs text-gray-500">
              <p>
                Campo opcional. Se usa solo para deduplicación y auditoría interna. Nunca compartimos el documento completo con empresas.
              </p>
              <p>
                Estado actual:{" "}
                <span className="font-semibold text-gray-700">
                  {clearIdentityOnSave
                    ? "Se eliminará al guardar"
                    : p.identity_masked || "Sin documento registrado"}
                </span>
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {p.has_identity ? (
                <button
                  type="button"
                  onClick={() => {
                    setClearIdentityOnSave(true);
                    setIdentityValue("");
                    setP((current) => ({
                      ...current,
                      identity_masked: null,
                      has_identity: false,
                      identity_type: null,
                    }));
                    setProfileMessage({ tone: "warning", text: "El documento se eliminará cuando guardes el perfil." });
                  }}
                  className="rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Borrar documento guardado
                </button>
              ) : null}
              {clearIdentityOnSave ? (
                <button
                  type="button"
                  onClick={() => {
                    setClearIdentityOnSave(false);
                    setP((current) => ({
                      ...current,
                      identity_type: persistedIdentity.identity_type,
                      identity_masked: persistedIdentity.identity_masked,
                      has_identity: persistedIdentity.has_identity,
                    }));
                    setProfileMessage(null);
                  }}
                  className="rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancelar borrado
                </button>
              ) : null}
            </div>
          </label>
        </div>
        {profileMessage ? <InlineStatusMessage tone={profileMessage.tone} message={profileMessage.text} /> : null}
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

      {accountMessage ? <InlineStatusMessage tone={accountMessage.tone} message={accountMessage.text} /> : null}
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

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block w-full">
      <div className="text-sm font-semibold text-gray-900">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
