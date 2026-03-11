"use client";

import { useEffect, useMemo, useState } from "react";

type Profile = Record<string, any>;

const EMPLOYEE_RANGES = ["1-10", "11-50", "51-200", "201-500", "500+"];
const HIRING_RANGES = ["1-5/mes", "6-20/mes", "21-50/mes", "50+/mes"];
const CONTRACT_TYPES = ["Indefinido", "Temporal", "Fijo-discontinuo", "Prácticas", "Autónomo"];
const WORKDAY_TYPES = ["Jornada completa", "Media jornada", "Turnos", "Noches", "Fines de semana"];

function statusLabel(statusRaw: unknown) {
  const status = String(statusRaw || "").toLowerCase();
  if (status === "verified_paid") return "Empresa verificada por suscripción";
  if (status === "verified_document") return "Empresa verificada por documentación";
  return "Empresa no verificada";
}

function statusClass(statusRaw: unknown) {
  const status = String(statusRaw || "").toLowerCase();
  if (status === "verified_paid") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "verified_document") return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 ${props.className || ""}`} />;
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 ${props.className || ""}`} />;
}

function parseCsvArray(value: string) {
  return value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export const dynamic = "force-dynamic";

export default function CompanyProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [membershipRole, setMembershipRole] = useState<string>("reviewer");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch("/api/company/profile", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!alive) return;
      if (!res.ok) {
        setError(data?.error || "No se pudo cargar el perfil de empresa.");
        setLoading(false);
        return;
      }
      setProfile(data.profile || {});
      setMembershipRole(String(data.membership_role || "reviewer"));
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  const completeness = Number(profile?.profile_completeness_score || 0);
  const hasInitialData = Boolean(
    profile?.legal_name ||
      profile?.trade_name ||
      profile?.contact_email ||
      profile?.website_url ||
      profile?.tax_id
  );
  const canEdit = membershipRole === "admin";
  const commonRolesText = useMemo(() => (profile?.common_roles_hired || []).join(", "), [profile?.common_roles_hired]);
  const languagesText = useMemo(() => (profile?.common_languages_required || []).join(", "), [profile?.common_languages_required]);
  const zonesText = useMemo(() => (profile?.hiring_zones || []).join(", "), [profile?.hiring_zones]);

  function updateField(key: string, value: any) {
    setProfile((prev) => ({ ...(prev || {}), [key]: value }));
  }

  async function saveProfile() {
    if (!profile) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    const payload = {
      ...profile,
      common_roles_hired: parseCsvArray(commonRolesText),
      common_languages_required: parseCsvArray(languagesText),
      hiring_zones: parseCsvArray(zonesText),
    };

    const res = await fetch("/api/company/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setError(data?.details || data?.error || "No se pudo guardar el perfil.");
      return;
    }

    setProfile(data.profile || profile);
    setMessage("Perfil de empresa actualizado correctamente.");
  }

  if (loading) return <p className="text-sm text-slate-600">Cargando perfil de empresa…</p>;

  if (!profile) return <p className="text-sm text-rose-600">No se pudo cargar el perfil de empresa.</p>;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Perfil de empresa</h1>
            <p className="mt-2 text-sm text-slate-600">
              Completa tu estructura operativa para mejorar confianza, trazabilidad y calidad de verificación en VERIJOB.
            </p>
            <div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(profile.company_verification_status)}`}>
              {statusLabel(profile.company_verification_status)}
            </div>
          </div>
          <div className="min-w-[220px] rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Estado del perfil</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{completeness}%</p>
            <div className="mt-2 h-2 rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.max(0, Math.min(100, completeness))}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-600">Completa los bloques para mejorar segmentación y credibilidad.</p>
          </div>
        </div>
        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}
        {!error && !hasInitialData ? (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            Perfil inicial sin completar. Añade los datos básicos de tu empresa y guarda para activar la configuración operativa.
          </div>
        ) : null}
      </section>

      <Section title="Identidad de empresa" subtitle="Información legal y de contacto principal para operaciones B2B.">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Razón social"><TextInput value={profile.legal_name || ""} onChange={(e) => updateField("legal_name", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Nombre comercial"><TextInput value={profile.trade_name || ""} onChange={(e) => updateField("trade_name", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="NIF/CIF"><TextInput value={profile.tax_id || ""} onChange={(e) => updateField("tax_id", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Tipo de empresa"><TextInput value={profile.company_type || ""} onChange={(e) => updateField("company_type", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Año de fundación"><TextInput type="number" value={profile.founding_year || ""} onChange={(e) => updateField("founding_year", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Web"><TextInput value={profile.website_url || ""} onChange={(e) => updateField("website_url", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Email de contacto"><TextInput value={profile.contact_email || ""} onChange={(e) => updateField("contact_email", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Teléfono de contacto"><TextInput value={profile.contact_phone || ""} onChange={(e) => updateField("contact_phone", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Persona de contacto"><TextInput value={profile.contact_person_name || ""} onChange={(e) => updateField("contact_person_name", e.target.value)} disabled={!canEdit} /></Field>
        </div>
      </Section>

      <Section title="Ubicación" subtitle="Datos para segmentación geográfica y cobertura operativa.">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="País"><TextInput value={profile.country || ""} onChange={(e) => updateField("country", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Región"><TextInput value={profile.region || ""} onChange={(e) => updateField("region", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Provincia"><TextInput value={profile.province || ""} onChange={(e) => updateField("province", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Ciudad"><TextInput value={profile.city || ""} onChange={(e) => updateField("city", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Código postal"><TextInput value={profile.postal_code || ""} onChange={(e) => updateField("postal_code", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Dirección fiscal"><TextInput value={profile.fiscal_address || ""} onChange={(e) => updateField("fiscal_address", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Dirección operativa"><TextInput value={profile.operating_address || ""} onChange={(e) => updateField("operating_address", e.target.value)} disabled={!canEdit} /></Field>
        </div>
      </Section>

      <Section title="Actividad" subtitle="Clasifica tu empresa para filtros de sector, mercado y automatización comercial.">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Sector"><TextInput value={profile.sector || ""} onChange={(e) => updateField("sector", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Subsector"><TextInput value={profile.subsector || ""} onChange={(e) => updateField("subsector", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Actividad principal"><TextInput value={profile.primary_activity || ""} onChange={(e) => updateField("primary_activity", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Modelo de negocio"><TextInput value={profile.business_model || ""} onChange={(e) => updateField("business_model", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Segmento de mercado"><TextInput value={profile.market_segment || ""} onChange={(e) => updateField("market_segment", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Origen del lead"><TextInput value={profile.lead_source || ""} onChange={(e) => updateField("lead_source", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Descripción"><TextArea rows={3} value={profile.business_description || ""} onChange={(e) => updateField("business_description", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Negocio estacional">
            <select className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={profile.seasonal_business ? "si" : "no"} onChange={(e) => updateField("seasonal_business", e.target.value === "si")} disabled={!canEdit}>
              <option value="no">No</option>
              <option value="si">Sí</option>
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Tamaño y contratación" subtitle="Parámetros para capacidad de equipo y patrones de contratación.">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Rango de empleados">
            <select className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={profile.employee_count_range || ""} onChange={(e) => updateField("employee_count_range", e.target.value)} disabled={!canEdit}>
              <option value="">Selecciona</option>
              {EMPLOYEE_RANGES.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </Field>
          <Field label="Nº ubicaciones"><TextInput type="number" value={profile.locations_count || ""} onChange={(e) => updateField("locations_count", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Volumen de contratación">
            <select className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={profile.annual_hiring_volume_range || ""} onChange={(e) => updateField("annual_hiring_volume_range", e.target.value)} disabled={!canEdit}>
              <option value="">Selecciona</option>
              {HIRING_RANGES.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </Field>
          <Field label="Tiene equipo de RRHH">
            <select className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={profile.has_internal_hr ? "si" : "no"} onChange={(e) => updateField("has_internal_hr", e.target.value === "si")} disabled={!canEdit}>
              <option value="no">No</option>
              <option value="si">Sí</option>
            </select>
          </Field>
          <Field label="Roles que contrata (separados por coma)"><TextInput value={commonRolesText} onChange={(e) => updateField("common_roles_hired", parseCsvArray(e.target.value))} disabled={!canEdit} /></Field>
          <Field label="Tipos de contrato">
            <select multiple className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm h-28" value={profile.common_contract_types || []} onChange={(e) => updateField("common_contract_types", Array.from(e.target.selectedOptions).map((o) => o.value))} disabled={!canEdit}>
              {CONTRACT_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </Field>
          <Field label="Tipos de jornada">
            <select multiple className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm h-28" value={profile.common_workday_types || []} onChange={(e) => updateField("common_workday_types", Array.from(e.target.selectedOptions).map((o) => o.value))} disabled={!canEdit}>
              {WORKDAY_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </Field>
          <Field label="Idiomas requeridos (separados por coma)"><TextInput value={languagesText} onChange={(e) => updateField("common_languages_required", parseCsvArray(e.target.value))} disabled={!canEdit} /></Field>
          <Field label="Zonas de contratación (separadas por coma)"><TextInput value={zonesText} onChange={(e) => updateField("hiring_zones", parseCsvArray(e.target.value))} disabled={!canEdit} /></Field>
        </div>
      </Section>

      <Section title="Verificación documental" subtitle="Sube y registra documentación fiscal para reforzar la credibilidad de tus verificaciones.">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Tipo de documento"><TextInput value={profile.verification_document_type || ""} onChange={(e) => updateField("verification_document_type", e.target.value)} placeholder="Modelo 036, CIF, equivalente" disabled={!canEdit} /></Field>
          <Field label="Referencia de documento (ruta o URL interna)"><TextInput value={profile.verification_document_storage_path || ""} onChange={(e) => updateField("verification_document_storage_path", e.target.value)} placeholder="company-docs/..." disabled={!canEdit} /></Field>
          <Field label="Notas de revisión"><TextArea rows={3} value={profile.verification_notes || ""} onChange={(e) => updateField("verification_notes", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Estado de verificación">
            <select className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={profile.company_verification_status || "unverified"} onChange={(e) => updateField("company_verification_status", e.target.value)} disabled={!canEdit}>
              <option value="unverified">Empresa no verificada</option>
              <option value="verified_document">Empresa verificada por documentación</option>
              <option value="verified_paid">Empresa verificada por suscripción</option>
            </select>
          </Field>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          El sistema puede usar estos datos como base para extracción automática y revisión asistida en fases siguientes.
        </p>
      </Section>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={saveProfile}
          disabled={!canEdit || saving}
          className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
        >
          {saving ? "Guardando…" : "Guardar perfil de empresa"}
        </button>
        {!canEdit ? (
          <p className="self-center text-sm text-slate-600">Solo usuarios admin pueden editar este perfil. Puedes revisar la información en modo lectura.</p>
        ) : null}
      </div>
    </div>
  );
}
