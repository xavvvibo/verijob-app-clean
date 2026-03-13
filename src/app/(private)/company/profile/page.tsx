"use client";

import { useEffect, useMemo, useState } from "react";

type Profile = Record<string, any>;
type CompanyVerificationDocument = {
  id: string;
  document_type?: string | null;
  storage_bucket?: string | null;
  storage_path?: string | null;
  original_filename?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  review_status?: string | null;
  rejected_reason?: string | null;
  review_notes?: string | null;
  reviewed_at?: string | null;
  lifecycle_status?: string | null;
  deleted_at?: string | null;
  extracted_json?: {
    confidence?: string | null;
    detected_fields_count?: number | null;
    detected?: Record<string, any> | null;
  } | null;
  extracted_at?: string | null;
  import_status?: string | null;
  imported_at?: string | null;
  import_notes?: string | null;
  created_at?: string | null;
};

const EMPLOYEE_RANGES = ["1-10", "11-50", "51-200", "201-500", "500+"];
const HIRING_RANGES = ["1-5/mes", "6-20/mes", "21-50/mes", "50+/mes"];
const CONTRACT_TYPES = ["Indefinido", "Temporal", "Fijo-discontinuo", "Prácticas", "Autónomo"];
const WORKDAY_TYPES = ["Jornada completa", "Media jornada", "Turnos", "Noches", "Fines de semana"];
const COMPANY_DOCUMENT_TYPES = [
  { value: "modelo_036", label: "Modelo 036" },
  { value: "modelo_037", label: "Modelo 037" },
  { value: "cif_nif", label: "CIF / NIF empresa" },
  { value: "certificado_censal", label: "Certificado censal / AEAT" },
  { value: "escritura", label: "Escritura o documento equivalente" },
  { value: "otro", label: "Otro documento" },
];

function statusLabel(statusRaw: unknown) {
  const status = String(statusRaw || "").toLowerCase();
  if (status === "verified") return "Verificada";
  if (status === "pending_review") return "Pendiente de revisión";
  if (status === "rejected") return "Rechazada";
  if (status === "unverified") return "No verificada";
  if (status === "verified_paid") return "Empresa verificada por suscripción";
  if (status === "verified_document") return "Empresa verificada por documentación";
  return "Empresa no verificada";
}

function statusClass(statusRaw: unknown) {
  const status = String(statusRaw || "").toLowerCase();
  if (status === "verified") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "pending_review") return "border-indigo-200 bg-indigo-50 text-indigo-800";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-800";
  if (status === "unverified") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "verified_paid") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "verified_document") return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function docTypeLabel(raw: unknown) {
  const v = String(raw || "").toLowerCase();
  return COMPANY_DOCUMENT_TYPES.find((d) => d.value === v)?.label || String(raw || "Documento");
}

function docStatusLabel(raw: unknown) {
  const v = String(raw || "").toLowerCase();
  if (v === "approved") return "Aprobada";
  if (v === "rejected") return "Rechazada";
  if (v === "pending_review") return "Pendiente de revisión";
  if (v === "uploaded") return "Documento subido";
  return "Pendiente de revisión";
}

function docStatusClass(raw: unknown) {
  const v = String(raw || "").toLowerCase();
  if (v === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (v === "rejected") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-indigo-200 bg-indigo-50 text-indigo-800";
}

function lifecycleLabel(raw: unknown) {
  const v = String(raw || "active").toLowerCase();
  if (v === "deleted") return "Eliminado";
  return "Activo";
}

function lifecycleClass(raw: unknown) {
  const v = String(raw || "active").toLowerCase();
  if (v === "deleted") return "border-slate-300 bg-slate-100 text-slate-600";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function importStatusLabel(raw: unknown) {
  const v = String(raw || "").toLowerCase();
  if (v === "imported") return "Importado al perfil";
  if (v === "no_changes") return "Sin cambios al importar";
  return "Pendiente de importación";
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
  const [documents, setDocuments] = useState<CompanyVerificationDocument[]>([]);
  const [reviewStatus, setReviewStatus] = useState<string>("unverified");
  const [documentsWarning, setDocumentsWarning] = useState<string | null>(null);
  const [docType, setDocType] = useState<string>(COMPANY_DOCUMENT_TYPES[0].value);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docActionLoadingId, setDocActionLoadingId] = useState<string | null>(null);
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
      setDocuments(Array.isArray(data.verification_documents) ? data.verification_documents : []);
      setReviewStatus(String(data?.profile?.company_verification_review_status || "unverified"));
      setDocumentsWarning(data?.verification_documents_warning ? String(data.verification_documents_warning) : null);
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
    setReviewStatus(String(data?.profile?.company_verification_review_status || reviewStatus));
    if (Array.isArray(data?.verification_documents)) {
      setDocuments(data.verification_documents);
    }
    setMessage("Perfil de empresa actualizado correctamente.");
  }

  async function uploadVerificationDocument() {
    if (!docFile) {
      setError("Selecciona un archivo para subir.");
      return;
    }

    setUploadingDoc(true);
    setError(null);
    setMessage(null);
    const fd = new FormData();
    fd.set("document_type", docType);
    fd.set("file", docFile);

    const res = await fetch("/api/company/profile/documents", {
      method: "POST",
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    setUploadingDoc(false);

    if (!res.ok) {
      setError(data?.details || data?.error || "No se pudo subir el documento.");
      return;
    }

    if (data?.document) {
      setDocuments((prev) => [data.document, ...prev]);
    }
    setReviewStatus("pending_review");
    setDocFile(null);
    setMessage("Documento subido. Estado actualizado a pendiente de revisión.");
  }

  async function importDetectedData(documentId: string) {
    setDocActionLoadingId(documentId);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/company/profile/documents", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "import_to_profile",
        document_id: documentId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setDocActionLoadingId(null);
    if (!res.ok) {
      setError(data?.details || data?.error || "No se pudieron importar los datos detectados.");
      return;
    }
    if (data?.document) {
      setDocuments((prev) => prev.map((d) => (d.id === documentId ? data.document : d)));
    }
    await loadProfileFresh();
    setMessage(`Datos importados al perfil (${Number(data?.imported_fields || 0)} campos).`);
  }

  async function deleteDocument(documentId: string) {
    const confirmed = window.confirm("Se eliminará el documento de forma lógica (soft delete) y quedará trazabilidad. ¿Continuar?");
    if (!confirmed) return;
    setDocActionLoadingId(documentId);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/company/profile/documents", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "delete",
        document_id: documentId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setDocActionLoadingId(null);
    if (!res.ok) {
      setError(data?.details || data?.error || "No se pudo eliminar el documento.");
      return;
    }
    if (data?.document) {
      setDocuments((prev) => prev.map((d) => (d.id === documentId ? data.document : d)));
    }
    await loadProfileFresh();
    setMessage("Documento eliminado de forma lógica.");
  }

  async function loadProfileFresh() {
    const res = await fetch("/api/company/profile", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return;
    setProfile(data.profile || {});
    setMembershipRole(String(data.membership_role || "reviewer"));
    setDocuments(Array.isArray(data.verification_documents) ? data.verification_documents : []);
    setReviewStatus(String(data?.profile?.company_verification_review_status || "unverified"));
    setDocumentsWarning(data?.verification_documents_warning ? String(data.verification_documents_warning) : null);
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
            <div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(reviewStatus)}`}>
              {statusLabel(reviewStatus)}
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
          <Field label="Cargo persona de contacto"><TextInput value={profile.contact_person_role || ""} onChange={(e) => updateField("contact_person_role", e.target.value)} disabled={!canEdit} /></Field>
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

      <Section title="Verificación documental de empresa" subtitle="Sube documentación oficial para iniciar o reforzar la verificación de empresa.">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-700">
            Estado actual:{" "}
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(reviewStatus)}`}>
              {statusLabel(reviewStatus)}
            </span>
          </p>
          <p className="mt-2 text-xs text-slate-600">
            La revisión es manual. Subir documentación no aprueba automáticamente la empresa.
          </p>
          {profile?.verification_rejection_reason ? (
            <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              Motivo de rechazo: {profile.verification_rejection_reason}
            </p>
          ) : null}
          {profile?.verification_last_reviewed_at ? (
            <p className="mt-2 text-xs text-slate-500">
              Última revisión: {new Date(String(profile.verification_last_reviewed_at)).toLocaleDateString("es-ES")}
            </p>
          ) : null}
          <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600">
            Cada documento mantiene trazabilidad propia: lifecycle, revisión manual, extracción de datos e importación controlada al perfil.
          </div>
        </div>

        {documentsWarning ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Falta migración para documentos múltiples: {documentsWarning}.
          </p>
        ) : null}

        {canEdit ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="Tipo de documento">
              <select
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
              >
                {COMPANY_DOCUMENT_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Archivo (PDF o imagen)">
              <input
                type="file"
                accept=".pdf,image/*"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                onChange={(e) => setDocFile(e.target.files?.[0] || null)}
              />
            </Field>
            <div className="md:col-span-2">
              <button
                type="button"
                onClick={uploadVerificationDocument}
                disabled={!docFile || uploadingDoc}
                className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
              >
                {uploadingDoc ? "Subiendo…" : "Subir documento de verificación"}
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-600">Solo admins de empresa pueden subir documentación de verificación.</p>
        )}

        <div className="mt-5">
          <h3 className="text-sm font-semibold text-slate-900">Documentos subidos</h3>
          {documents.length === 0 ? (
            <p className="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600">
              No hay documentos de verificación subidos todavía.
            </p>
          ) : (
            <div className="mt-2 overflow-auto">
              <table className="min-w-[860px] w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Lifecycle</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Archivo</th>
                    <th className="px-3 py-2">Extracción</th>
                    <th className="px-3 py-2">Importación</th>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Revisión</th>
                    {canEdit ? <th className="px-3 py-2">Acciones</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} className="border-b border-slate-100 text-slate-800">
                      <td className="px-3 py-2">{docTypeLabel(doc.document_type)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${lifecycleClass(doc.lifecycle_status)}`}>
                          {lifecycleLabel(doc.lifecycle_status)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${docStatusClass(doc.review_status)}`}>
                          {docStatusLabel(doc.review_status)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {doc.original_filename || doc.storage_path || "documento"}
                        {doc.mime_type ? <div className="text-[11px] text-slate-500">{doc.mime_type}</div> : null}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {Number(doc?.extracted_json?.detected_fields_count || 0) > 0 ? (
                          <div>
                            <div className="font-medium text-slate-700">
                              {doc.extracted_json?.detected_fields_count} campos detectados
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Confianza {String(doc.extracted_json?.confidence || "baja")}
                            </div>
                            {doc.extracted_json?.detected ? (
                              <div className="mt-1 text-[11px] text-slate-500">
                                {Object.entries(doc.extracted_json.detected)
                                  .filter(([, v]) => Boolean(v))
                                  .slice(0, 3)
                                  .map(([k]) => k.replaceAll("_", " "))
                                  .join(", ")}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500">Sin extracción útil</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        <div>{importStatusLabel(doc.import_status)}</div>
                        {doc.imported_at ? (
                          <div className="text-[11px] text-slate-500">
                            {new Date(String(doc.imported_at)).toLocaleDateString("es-ES")}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">{doc.created_at ? new Date(String(doc.created_at)).toLocaleDateString("es-ES") : "—"}</td>
                      <td className="px-3 py-2">
                        {doc.rejected_reason || doc.review_notes ? (
                          <span className="text-xs text-rose-700">{doc.rejected_reason || doc.review_notes}</span>
                        ) : doc.reviewed_at ? (
                          <span className="text-xs text-slate-600">Revisado {new Date(String(doc.reviewed_at)).toLocaleDateString("es-ES")}</span>
                        ) : (
                          <span className="text-xs text-slate-500">Pendiente de revisión manual</span>
                        )}
                      </td>
                      {canEdit ? (
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-2">
                            {String(doc.lifecycle_status || "active").toLowerCase() !== "deleted" ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => importDetectedData(doc.id)}
                                  disabled={docActionLoadingId === doc.id || Number(doc?.extracted_json?.detected_fields_count || 0) === 0}
                                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                >
                                  {docActionLoadingId === doc.id ? "Procesando…" : "Importar al perfil"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteDocument(doc.id)}
                                  disabled={docActionLoadingId === doc.id}
                                  className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                                >
                                  Eliminar
                                </button>
                              </>
                            ) : (
                              <span className="text-[11px] text-slate-500">Documento archivado (soft delete)</span>
                            )}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
