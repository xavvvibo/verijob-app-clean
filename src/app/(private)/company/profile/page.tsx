"use client";

import { useEffect, useMemo, useState } from "react";
import { companyVerificationMethodTone } from "@/lib/company/verification-method";

type Profile = Record<string, any>;
type CompanyVerificationDocument = {
  id: string;
  document_type?: string | null;
  status?: string | null;
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

type DocumentsMeta = {
  code?: string | null;
  title?: string | null;
  message?: string | null;
  migration_files?: string[] | null;
} | null;

type ProfileCompletionItem = {
  id: string;
  title: string;
  description: string;
  status: "completed" | "pending" | "recommended" | "optional";
  priority: "required" | "recommended" | "optional";
  completed: number;
  total: number;
};

type ProfileCompletion = {
  score?: number | null;
  required?: { completed?: number | null; total?: number | null } | null;
  recommended?: { completed?: number | null; total?: number | null } | null;
  optional?: { completed?: number | null; total?: number | null } | null;
  checklist?: ProfileCompletionItem[] | null;
} | null;

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
const COMPANY_PROFILE_FIELD_LABELS: Record<string, string> = {
  legal_name: "Razón social",
  trade_name: "Nombre comercial",
  tax_id: "CIF",
  fiscal_address: "Domicilio fiscal",
  postal_code: "Código postal",
  city: "Ciudad",
  province: "Provincia",
  country: "País",
  contact_person_name: "Persona de contacto",
  contact_email: "Email de contacto",
  contact_phone: "Teléfono de contacto",
};

function statusLabel(statusRaw: unknown) {
  const status = String(statusRaw || "").toLowerCase();
  if (status === "verified") return "Verificada documentalmente";
  if (status === "uploaded") return "Documento recibido";
  if (status === "under_review") return "En revisión";
  if (status === "rejected") return "Requiere corrección";
  return "Sin documento";
}

function statusClass(statusRaw: unknown) {
  const status = String(statusRaw || "").toLowerCase();
  if (status === "verified") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "uploaded" || status === "under_review") return "border-indigo-200 bg-indigo-50 text-indigo-800";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-800";
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
  if (v === "pending_review") return "En revisión";
  if (v === "uploaded") return "Documento recibido";
  return "En revisión";
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

function companyProfileFieldLabel(raw: unknown) {
  const key = String(raw || "").trim();
  return COMPANY_PROFILE_FIELD_LABELS[key] || key.replaceAll("_", " ");
}

function extractionSummary(doc: CompanyVerificationDocument) {
  const count = Number(doc?.extracted_json?.detected_fields_count || 0);
  if (count <= 0) {
    return {
      label: "Sin datos útiles detectados",
      detail: "Puedes subir otro documento más legible si quieres completar mejor el perfil.",
    };
  }
  if (count <= 2) {
    return {
      label: "Pocos datos detectados",
      detail: `${count} campo${count === 1 ? "" : "s"} detectado${count === 1 ? "" : "s"} para ayudarte a completar el perfil.`,
    };
  }
  if (count <= 5) {
    return {
      label: "Datos detectados",
      detail: `${count} campos detectados para ayudarte a completar el perfil.`,
    };
  }
  return {
    label: "Muchos datos detectados",
    detail: `${count} campos detectados para completar el perfil con más rapidez.`,
  };
}

function documentaryNextStep(doc: CompanyVerificationDocument) {
  const lifecycle = String(doc.lifecycle_status || "active").toLowerCase();
  const review = String(doc.review_status || "").toLowerCase();
  const detected = Number(doc?.extracted_json?.detected_fields_count || 0);
  const importStatus = String(doc.import_status || "").toLowerCase();

  if (lifecycle === "deleted") return "Documento archivado. No requiere acción adicional.";
  if (review === "rejected") return "Revisa el motivo indicado y sube una nueva versión del documento.";
  if (review === "pending_review" || review === "uploaded") {
    return detected > 0
      ? "La revisión interna sigue abierta. Si te encajan, puedes importar ya los datos detectados para adelantar el perfil de empresa."
      : "La revisión interna sigue abierta. No necesitas hacer nada más hasta que revisemos el documento.";
  }
  if (review === "approved") {
    if (detected > 0 && importStatus !== "imported") {
      return "Documento validado. Puedes importar los datos detectados al perfil de empresa si te encajan.";
    }
    return "Documento validado. No requiere más acciones.";
  }
  return "Documento recibido. Te avisaremos si hace falta revisar o completar algo.";
}

function globalDocumentarySummary(input: {
  approvedDocumentsCount: number;
  pendingDocumentsCount: number;
  rejectedDocumentsCount: number;
  activeDocumentsCount: number;
}) {
  const { approvedDocumentsCount, pendingDocumentsCount, rejectedDocumentsCount, activeDocumentsCount } = input;
  if (approvedDocumentsCount > 0) {
    return {
      title: "La verificación documental ya está completada",
      detail:
        pendingDocumentsCount > 0
          ? "Ya tienes documentación válida, aunque aún queda alguna revisión abierta en documentos más recientes."
          : "Tu empresa ya cuenta con al menos un documento validado.",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
    };
  }
  if (pendingDocumentsCount > 0) {
    return {
      title: "Tu documentación está en revisión",
      detail: "Hemos recibido tus documentos. La revisión documental sigue abierta hasta confirmar la validez de la empresa.",
      tone: "border-indigo-200 bg-indigo-50 text-indigo-900",
    };
  }
  if (rejectedDocumentsCount > 0) {
    return {
      title: "Hay documentación rechazada pendiente de corregir",
      detail: "Revisa el motivo indicado en cada documento y sube una nueva versión para retomar la validación.",
      tone: "border-rose-200 bg-rose-50 text-rose-900",
    };
  }
  if (activeDocumentsCount > 0) {
    return {
      title: "La documentación se ha recibido correctamente",
      detail: "El flujo sigue abierto hasta que la revisión manual confirme la validez del documento.",
      tone: "border-slate-200 bg-slate-50 text-slate-900",
    };
  }
  return {
    title: "Todavía no has iniciado la verificación documental",
    detail: "Sube un documento oficial para iniciar la revisión documental de tu empresa.",
    tone: "border-slate-200 bg-slate-50 text-slate-900",
  };
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

function ToggleChip({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {label}
    </button>
  );
}

function parseCsvArray(value: string) {
  return value
    .split(/[\n,]/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

function formatListInput(value: unknown) {
  return Array.isArray(value) ? value.join(", ") : "";
}

function checklistStatusLabel(value: ProfileCompletionItem["status"]) {
  if (value === "completed") return "Completado";
  if (value === "recommended") return "Recomendado";
  if (value === "optional") return "Opcional";
  return "Pendiente";
}

function checklistStatusClass(value: ProfileCompletionItem["status"]) {
  if (value === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (value === "recommended") return "border-blue-200 bg-blue-50 text-blue-800";
  if (value === "optional") return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function buildDocumentsMetaFromResponse(data: any): DocumentsMeta {
  if (!data?.status && !data?.warning && !data?.migration_files?.length) return null;
  return {
    code: data?.error || data?.warning || data?.status || null,
    title:
      data?.title ||
      (String(data?.status || data?.warning || "").includes("schema_drift")
        ? "Módulo documental pendiente de sincronizar"
        : "Módulo documental no disponible"),
    message: data?.message || data?.user_message || null,
    migration_files: Array.isArray(data?.migration_files) ? data.migration_files : [],
  };
}

export const dynamic = "force-dynamic";

export default function CompanyProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [membershipRole, setMembershipRole] = useState<string>("reviewer");
  const [documents, setDocuments] = useState<CompanyVerificationDocument[]>([]);
  const [reviewStatus, setReviewStatus] = useState<string>("unverified");
  const [documentsMeta, setDocumentsMeta] = useState<DocumentsMeta>(null);
  const [docType, setDocType] = useState<string>(COMPANY_DOCUMENT_TYPES[0].value);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docActionLoadingId, setDocActionLoadingId] = useState<string | null>(null);
  const [commonRolesText, setCommonRolesText] = useState("");
  const [languagesText, setLanguagesText] = useState("");
  const [zonesText, setZonesText] = useState("");
  const [completion, setCompletion] = useState<ProfileCompletion>(null);
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
      setReviewStatus(String(data?.profile?.company_document_verification_status || data?.profile?.company_verification_review_status || "none"));
      setDocumentsMeta(data?.verification_documents_meta || null);
      setCommonRolesText(formatListInput(data?.profile?.common_roles_hired));
      setLanguagesText(formatListInput(data?.profile?.common_languages_required));
      setZonesText(formatListInput(data?.profile?.hiring_zones));
      setCompletion(data?.profile_completion || null);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  const completeness = Number(completion?.score ?? profile?.profile_completeness_score ?? 0);
  const hasInitialData = Boolean(
    profile?.legal_name ||
      profile?.trade_name ||
      profile?.contact_email ||
      profile?.website_url ||
      profile?.tax_id
  );
  const canEdit = membershipRole === "admin";
  const activeDocuments = useMemo(
    () => documents.filter((doc) => String(doc.lifecycle_status || "active").toLowerCase() !== "deleted"),
    [documents]
  );
  const deletedDocuments = Math.max(0, documents.length - activeDocuments.length);
  const approvedDocumentsCount = useMemo(
    () => activeDocuments.filter((doc) => String(doc.review_status || "").toLowerCase() === "approved").length,
    [activeDocuments]
  );
  const pendingDocumentsCount = useMemo(
    () =>
      activeDocuments.filter((doc) => {
        const value = String(doc.review_status || "").toLowerCase();
        return value === "pending_review" || value === "uploaded";
      }).length,
    [activeDocuments]
  );
  const rejectedDocumentsCount = useMemo(
    () => activeDocuments.filter((doc) => String(doc.review_status || "").toLowerCase() === "rejected").length,
    [activeDocuments]
  );
  const documentsWithDetectedDataCount = useMemo(
    () => activeDocuments.filter((doc) => Number(doc?.extracted_json?.detected_fields_count || 0) > 0).length,
    [activeDocuments]
  );
  const documentarySummary = useMemo(
    () =>
      globalDocumentarySummary({
        approvedDocumentsCount,
        pendingDocumentsCount,
        rejectedDocumentsCount,
        activeDocumentsCount: activeDocuments.length,
      }),
    [activeDocuments.length, approvedDocumentsCount, pendingDocumentsCount, rejectedDocumentsCount]
  );

  function updateField(key: string, value: any) {
    setProfile((prev) => ({ ...(prev || {}), [key]: value }));
  }

  function toggleArrayField(key: string, value: string) {
    setProfile((prev) => {
      const current = Array.isArray(prev?.[key]) ? prev[key] : [];
      const exists = current.includes(value);
      return {
        ...(prev || {}),
        [key]: exists ? current.filter((item: string) => item !== value) : [...current, value],
      };
    });
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
    setReviewStatus(String(data?.profile?.company_document_verification_status || data?.profile?.company_verification_review_status || reviewStatus));
    if (Array.isArray(data?.verification_documents)) {
      setDocuments(data.verification_documents);
    }
    setCompletion(data?.profile_completion || completion);
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
      setError(
        data?.user_message ||
          data?.details ||
          data?.error ||
          "No se pudo subir el documento."
      );
      return;
    }

    if (!data?.ok) {
      setError(data?.user_message || "No se pudo registrar el documento de verificación.");
      return;
    }

    const nextDocuments = Array.isArray(data?.documents)
      ? data.documents
      : data?.document
        ? [data.document, ...documents]
        : documents;
    setDocuments(nextDocuments);
    setDocumentsMeta(buildDocumentsMetaFromResponse(data));
    setReviewStatus(String(data?.documentary_status || "under_review"));
    setDocFile(null);
    const refreshed = await loadProfileFresh();
    setMessage(data?.user_message || "Documento subido correctamente. Estamos revisándolo.");
    if (!refreshed && nextDocuments.length === 0) {
      setError("El documento se subió, pero no se pudo refrescar el histórico de forma automática.");
    }
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
      setError(data?.user_message || data?.details || data?.error || "No se pudieron importar los datos detectados.");
      return;
    }
    if (data?.document) {
      setDocuments((prev) => prev.map((d) => (d.id === documentId ? data.document : d)));
    }
    await loadProfileFresh();
    const importedLabels = Array.isArray(data?.imported_field_names)
      ? data.imported_field_names.map((field: string) => companyProfileFieldLabel(field))
      : [];
    const skippedLabels = Array.isArray(data?.skipped_field_names)
      ? data.skipped_field_names.map((field: string) => companyProfileFieldLabel(field))
      : [];
    const importedCount = Number(data?.imported_fields || 0);

    if (importedCount > 0) {
      setMessage(
        `Datos importados al perfil (${importedCount} campo${importedCount === 1 ? "" : "s"}): ${importedLabels.join(", ")}${
          skippedLabels.length ? `. Sin cambios: ${skippedLabels.join(", ")}.` : "."
        }`,
      );
      return;
    }

    setMessage(
      skippedLabels.length
        ? `Hemos revisado el documento. No había cambios nuevos para importar. Ya estaban cubiertos: ${skippedLabels.join(", ")}.`
        : "Hemos revisado el documento, pero no se detectaron datos aplicables al perfil.",
    );
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
      setError(data?.user_message || data?.details || data?.error || "No se pudo eliminar el documento.");
      return;
    }
    if (data?.document) {
      setDocuments((prev) => prev.map((d) => (d.id === documentId ? data.document : d)));
    }
    await loadProfileFresh();
    setMessage("Documento eliminado de forma lógica.");
  }

  async function loadProfileFresh() {
    const [profileRes, docsRes] = await Promise.all([
      fetch("/api/company/profile", { cache: "no-store" }),
      fetch("/api/company/profile/documents", { cache: "no-store" }),
    ]);
    const [profileData, docsData] = await Promise.all([
      profileRes.json().catch(() => ({})),
      docsRes.json().catch(() => ({})),
    ]);
    if (!profileRes.ok) return false;
    const docsFromProfile = Array.isArray(profileData.verification_documents) ? profileData.verification_documents : [];
    const docsFromEndpoint = docsRes.ok && Array.isArray(docsData.documents) ? docsData.documents : [];
    const documentsMetaFromProfile = profileData?.verification_documents_meta || null;
    const documentsMetaFromDocs = buildDocumentsMetaFromResponse(docsData);
    setProfile(profileData.profile || {});
    setMembershipRole(String(profileData.membership_role || "reviewer"));
    setDocuments(docsFromProfile.length > 0 || !docsRes.ok ? docsFromProfile : docsFromEndpoint);
    setReviewStatus(String(profileData?.profile?.company_document_verification_status || profileData?.profile?.company_verification_review_status || "none"));
    setDocumentsMeta(documentsMetaFromProfile || documentsMetaFromDocs);
    setCommonRolesText(formatListInput(profileData?.profile?.common_roles_hired));
    setLanguagesText(formatListInput(profileData?.profile?.common_languages_required));
    setZonesText(formatListInput(profileData?.profile?.hiring_zones));
    setCompletion(profileData?.profile_completion || null);
    return true;
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
            {profile?.company_document_verification_detail ? (
              <p className="mt-2 text-sm text-slate-600">{String(profile.company_document_verification_detail)}</p>
            ) : null}
            {profile?.company_document_review_eta_label && (reviewStatus === "uploaded" || reviewStatus === "under_review") ? (
              <p className="mt-2 text-sm text-slate-600">
                Tiempo estimado de revisión: {String(profile.company_document_review_eta_label)}
                {profile?.company_document_review_priority_label ? ` · ${String(profile.company_document_review_priority_label)}` : ""}
              </p>
            ) : null}
            <div className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${companyVerificationMethodTone(profile?.company_verification_method || "none")}`}>
              {profile?.company_verification_method_label || "Sin señal adicional confirmada"}
            </div>
            {profile?.company_verification_method_detail ? (
              <p className="mt-2 text-sm text-slate-500">Señales adicionales: {String(profile.company_verification_method_detail)}</p>
            ) : null}
          </div>
          <div className="min-w-[260px] rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Perfil listo para operación</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{completeness}%</p>
            <div className="mt-2 h-2 rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.max(0, Math.min(100, completeness))}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Obligatorios y recomendados cuentan. Los opcionales no penalizan el porcentaje.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-slate-600">
              <div className="rounded-xl border border-slate-200 bg-white px-2 py-2">
                <div className="font-semibold text-slate-900">{Number(completion?.required?.completed || 0)}/{Number(completion?.required?.total || 0)}</div>
                <div>Obligatorio</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-2 py-2">
                <div className="font-semibold text-slate-900">{Number(completion?.recommended?.completed || 0)}/{Number(completion?.recommended?.total || 0)}</div>
                <div>Recomendado</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-2 py-2">
                <div className="font-semibold text-slate-900">{Number(completion?.optional?.completed || 0)}/{Number(completion?.optional?.total || 0)}</div>
                <div>Opcional</div>
              </div>
            </div>
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

      {Array.isArray(completion?.checklist) && completion?.checklist?.length ? (
        <Section title="Checklist del perfil" subtitle="Vista clara de lo que ya esta listo y lo que conviene completar antes de lanzamiento.">
          <div className="grid gap-3 lg:grid-cols-2">
            {completion.checklist.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                    <p className="mt-1 text-xs text-slate-600">{item.description}</p>
                  </div>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${checklistStatusClass(item.status)}`}>
                    {checklistStatusLabel(item.status)}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>{item.priority === "required" ? "Obligatorio" : item.priority === "recommended" ? "Recomendado" : "Opcional"}</span>
                  <span>{item.completed}/{item.total}</span>
                </div>
              </article>
            ))}
          </div>
        </Section>
      ) : null}

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
          <Field label="Roles que contrata">
            <TextArea
              rows={2}
              value={commonRolesText}
              onChange={(e) => setCommonRolesText(e.target.value)}
              disabled={!canEdit}
              placeholder="camarero, jefe de rango, encargado"
            />
            <span className="mt-1 block text-xs text-slate-500">Puedes escribir texto natural separado por comas o saltos de línea.</span>
          </Field>
          <Field label="Tipos de contrato">
            <div className="flex flex-wrap gap-2">
              {CONTRACT_TYPES.map((x) => (
                <ToggleChip
                  key={x}
                  label={x}
                  active={Array.isArray(profile.common_contract_types) && profile.common_contract_types.includes(x)}
                  disabled={!canEdit}
                  onClick={() => toggleArrayField("common_contract_types", x)}
                />
              ))}
            </div>
            <span className="mt-1 block text-xs text-slate-500">Puedes seleccionar varias modalidades a la vez.</span>
          </Field>
          <Field label="Tipos de jornada">
            <div className="flex flex-wrap gap-2">
              {WORKDAY_TYPES.map((x) => (
                <ToggleChip
                  key={x}
                  label={x}
                  active={Array.isArray(profile.common_workday_types) && profile.common_workday_types.includes(x)}
                  disabled={!canEdit}
                  onClick={() => toggleArrayField("common_workday_types", x)}
                />
              ))}
            </div>
            <span className="mt-1 block text-xs text-slate-500">Marca todas las jornadas que uses en contratación real.</span>
          </Field>
          <Field label="Idiomas requeridos">
            <TextArea
              rows={2}
              value={languagesText}
              onChange={(e) => setLanguagesText(e.target.value)}
              disabled={!canEdit}
              placeholder="espanol, ingles, catalan"
            />
            <span className="mt-1 block text-xs text-slate-500">Admite comas y espacios normales sin cortar la escritura.</span>
          </Field>
          <Field label="Zonas de contratación">
            <TextArea
              rows={2}
              value={zonesText}
              onChange={(e) => setZonesText(e.target.value)}
              disabled={!canEdit}
              placeholder="Barcelona ciudad, Hospitalet, Badalona"
            />
            <span className="mt-1 block text-xs text-slate-500">Usa zonas reales de cobertura. Se guardan como lista compatible con el modelo actual.</span>
          </Field>
        </div>
      </Section>

      <Section title="Verificación documental de empresa" subtitle="Sube documentación oficial para iniciar o reforzar la verificación de empresa.">
        <div className={`rounded-xl border p-4 ${documentarySummary.tone}`}>
          <p className="text-sm text-slate-700">
            Estado actual:{" "}
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(reviewStatus)}`}>
              {statusLabel(reviewStatus)}
            </span>
          </p>
          <p className="mt-3 text-sm font-semibold">{documentarySummary.title}</p>
          <p className="mt-1 text-xs text-slate-600">{documentarySummary.detail}</p>
          {profile?.company_document_latest_document_type ? (
            <p className="mt-2 text-xs text-slate-600">
              Documento recibido: {docTypeLabel(profile.company_document_latest_document_type)}
              {profile?.company_document_last_submitted_at
                ? ` · enviado el ${new Date(String(profile.company_document_last_submitted_at)).toLocaleDateString("es-ES")}`
                : ""}
            </p>
          ) : null}
          {profile?.company_document_review_eta_label && (reviewStatus === "uploaded" || reviewStatus === "under_review") ? (
            <p className="mt-2 text-xs text-slate-600">
              Tiempo estimado de revisión según tu plan: {String(profile.company_document_review_eta_label)}
              {profile?.company_document_review_priority_label ? ` · ${String(profile.company_document_review_priority_label)}` : ""}
            </p>
          ) : null}
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-3 text-xs text-slate-700">
              <div className="font-semibold text-slate-900">Documentos activos</div>
              <div className="mt-1">{activeDocuments.length}</div>
            </div>
            <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-3 text-xs text-slate-700">
              <div className="font-semibold text-slate-900">Pendientes de revisión</div>
              <div className="mt-1">{pendingDocumentsCount}</div>
            </div>
            <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-3 text-xs text-slate-700">
              <div className="font-semibold text-slate-900">Con datos detectados</div>
              <div className="mt-1">{documentsWithDetectedDataCount}</div>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-600">
            La revisión documental no es instantánea. Incorporar datos al perfil te ayuda a completar la ficha, pero no valida por sí solo la empresa.
          </p>
          {profile?.company_document_rejection_reason || profile?.verification_rejection_reason ? (
            <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              Motivo de corrección: {profile.company_document_rejection_reason || profile.verification_rejection_reason}
            </p>
          ) : null}
          {(profile?.company_document_last_reviewed_at || profile?.verification_last_reviewed_at) ? (
            <p className="mt-2 text-xs text-slate-500">
              Última revisión: {new Date(String(profile.company_document_last_reviewed_at || profile.verification_last_reviewed_at)).toLocaleDateString("es-ES")}
            </p>
          ) : null}
          <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600">
            Verás por separado el estado del documento, los datos detectados para completar el perfil y la siguiente acción recomendada en cada caso.
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600">
              <div className="font-semibold text-slate-900">1. Documento recibido</div>
              <div className="mt-1">
                {profile?.company_document_last_submitted_at
                  ? `Registrado el ${new Date(String(profile.company_document_last_submitted_at)).toLocaleDateString("es-ES")}`
                  : "Pendiente de primera subida"}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600">
              <div className="font-semibold text-slate-900">2. Revisión en curso</div>
              <div className="mt-1">
                {profile?.company_document_review_priority_label || "Cola estándar"}
                {profile?.company_document_review_eta_label ? ` · ${String(profile.company_document_review_eta_label)}` : ""}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600">
              <div className="font-semibold text-slate-900">3. Resolución visible</div>
              <div className="mt-1">
                {(profile?.company_document_last_reviewed_at || profile?.verification_last_reviewed_at)
                  ? `Actualizada el ${new Date(String(profile.company_document_last_reviewed_at || profile.verification_last_reviewed_at)).toLocaleDateString("es-ES")}`
                  : "Se mostrará aquí cuando termine la revisión"}
              </div>
            </div>
          </div>
        </div>

        {documentsMeta ? (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">{documentsMeta.title}</p>
            <p className="mt-1 text-xs">{documentsMeta.message}</p>
            {Array.isArray(documentsMeta.migration_files) && documentsMeta.migration_files.length ? (
              <div className="mt-2 text-xs">
                SQL pendiente:
                <ul className="mt-1 space-y-1">
                  {documentsMeta.migration_files.map((file) => (
                    <li key={file}>{file}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
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
                disabled={Boolean(documentsMeta)}
              />
            </Field>
            <div className="md:col-span-2">
              <button
                type="button"
                onClick={uploadVerificationDocument}
                disabled={!docFile || uploadingDoc || Boolean(documentsMeta)}
                className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
              >
                {uploadingDoc ? "Subiendo…" : "Subir documento de verificación"}
              </button>
              <p className="mt-2 text-xs text-slate-500">
                Puedes añadir varios documentos del mismo tipo sin perder trazabilidad histórica.
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-600">Solo admins de empresa pueden subir documentación de verificación.</p>
        )}

        <div className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">Histórico documental</h3>
            <div className="flex gap-2 text-xs text-slate-600">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Activos: {activeDocuments.length}</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Eliminados: {deletedDocuments}</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            Cada fila indica si el documento ya está revisado, si sigue pendiente y si puede aportar datos útiles al perfil de empresa.
          </p>
          {documents.length === 0 ? (
            <p className="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600">
              {documentsMeta
                ? "La gestión documental quedará disponible cuando se apliquen las migraciones del módulo documental."
                : "No hay documentos de verificación subidos todavía."}
            </p>
          ) : (
            <div className="mt-2 overflow-auto">
              <table className="min-w-[860px] w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Estado documental</th>
                    <th className="px-3 py-2">Datos detectados</th>
                    <th className="px-3 py-2">Siguiente paso</th>
                    {canEdit ? <th className="px-3 py-2">Acciones</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} className="border-b border-slate-100 text-slate-800">
                      <td className="px-3 py-2">{docTypeLabel(doc.document_type)}</td>
                      <td className="px-3 py-2">{doc.created_at ? new Date(String(doc.created_at)).toLocaleDateString("es-ES") : "—"}</td>
                      <td className="px-3 py-2">
                        <div className="space-y-1">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${docStatusClass(doc.review_status)}`}>
                            {docStatusLabel(doc.review_status)}
                          </span>
                          <div>
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${lifecycleClass(doc.lifecycle_status)}`}>
                              {lifecycleLabel(doc.lifecycle_status)}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {doc.original_filename || `${docTypeLabel(doc.document_type)} subido`}
                            {doc.mime_type ? ` · ${doc.mime_type}` : ""}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {Number(doc?.extracted_json?.detected_fields_count || 0) > 0 ? (
                          <div>
                            <div className="font-medium text-slate-700">{extractionSummary(doc).label}</div>
                            <div className="text-[11px] text-slate-500">{extractionSummary(doc).detail}</div>
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
                          <span className="text-[11px] text-slate-500">Todavía no hemos detectado datos útiles para completar el perfil.</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        <div>{documentaryNextStep(doc)}</div>
                        {doc.rejected_reason || doc.review_notes ? (
                          <div className="mt-1 text-[11px] text-rose-700">{doc.rejected_reason || doc.review_notes}</div>
                        ) : doc.reviewed_at ? (
                          <div className="mt-1 text-[11px] text-slate-500">
                            Revisado el {new Date(String(doc.reviewed_at)).toLocaleDateString("es-ES")}
                          </div>
                        ) : null}
                        {String(doc.import_status || "").toLowerCase() !== "" ? (
                          <div className="mt-1 text-[11px] text-slate-500">{importStatusLabel(doc.import_status)}</div>
                        ) : null}
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
                                  {docActionLoadingId === doc.id ? "Procesando…" : "Importar datos detectados al perfil"}
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
