"use client";

import { useMemo, useState } from "react";
import { resolveEvidenceEmploymentRecordId } from "@/lib/candidate/evidence-linkage";
import {
  getEvidenceTypeOptions,
  getEvidenceTypeLabel,
  normalizeEvidenceType,
} from "@/lib/candidate/evidence-types";

type EvidenceItem = {
  id: string;
  document_name: string;
  document_type: string;
  experience: string;
  status: string;
  reason: string | null;
  created_at: string | null;
  scope_label: string;
  processing_label: string;
  trust_label: string | null;
};

type ExperienceOption = {
  id: string;
  label: string;
};

const STORAGE_KEY = "candidate_hidden_evidence_ids_v1";
const EVIDENCE_OPTIONS = getEvidenceTypeOptions();

function formatEsDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function readHiddenIds() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set<string>();
  }
}

function writeHiddenIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
}

async function prepareEvidenceUpload(payload: Record<string, any>) {
  const endpoints = [
    "/api/candidate/evidence/upload",
    "/api/candidate/evidence/upload-url",
  ];

  let lastError = "No se pudo preparar la subida de la evidencia.";

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => ({}));
      if (response.ok && json?.signed_url && json?.storage_path && json?.verification_request_id) {
        return json;
      }
      lastError = String(json?.error || json?.details || lastError).trim() || lastError;
    } catch (error: any) {
      lastError = String(error?.message || error || lastError).trim() || lastError;
    }
  }

  throw new Error(lastError);
}

async function sha256Hex(file: File) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function EvidenceListClient({
  initialItems,
  experienceOptions,
  preselectedExperienceId,
}: {
  initialItems: EvidenceItem[];
  experienceOptions: ExperienceOption[];
  preselectedExperienceId?: string;
}) {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => readHiddenIds());
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [selectedExperienceId, setSelectedExperienceId] = useState<string>(
    preselectedExperienceId && experienceOptions.some((x) => x.id === preselectedExperienceId)
      ? preselectedExperienceId
      : experienceOptions[0]?.id || ""
  );
  const [selectedEvidenceType, setSelectedEvidenceType] = useState<string>("vida_laboral");
  const [file, setFile] = useState<File | null>(null);
  const selectedTypeConfig = useMemo(
    () => EVIDENCE_OPTIONS.find((opt) => opt.key === selectedEvidenceType) || EVIDENCE_OPTIONS[0],
    [selectedEvidenceType]
  );
  const requiresExperience = Boolean(selectedTypeConfig?.requiresExperience);

  const visibleItems = useMemo(
    () => initialItems.filter((item) => !hiddenIds.has(item.id) && !removedIds.has(item.id)),
    [initialItems, hiddenIds, removedIds]
  );
  const selectedExperienceLabel = useMemo(
    () => experienceOptions.find((item) => item.id === selectedExperienceId)?.label || null,
    [experienceOptions, selectedExperienceId]
  );

  async function uploadEvidence() {
    if (!file) {
      setUploadMessage("Selecciona un documento para subir.");
      return;
    }
    if (requiresExperience && !selectedExperienceId) {
      setUploadMessage("Selecciona una experiencia para asociar la evidencia.");
      return;
    }

    setUploading(true);
    setUploadMessage(null);
    try {
      const { employmentRecordId } = resolveEvidenceEmploymentRecordId({
        filename: file.name,
        options: experienceOptions,
        selectedExperienceId: requiresExperience ? selectedExperienceId : "",
      });
      const fileHash = await sha256Hex(file);

      const prepareJson = await prepareEvidenceUpload({
        employment_record_id: requiresExperience ? employmentRecordId : null,
        mime: file.type || "application/octet-stream",
        size_bytes: file.size,
        filename: file.name,
        evidence_type: normalizeEvidenceType(selectedEvidenceType),
        file_sha256: fileHash,
      });

      const binaryUploadRes = await fetch(prepareJson.signed_url, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!binaryUploadRes.ok) {
        throw new Error("No se pudo subir el archivo al almacenamiento.");
      }

      const confirmRes = await fetch("/api/candidate/evidence/confirm", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          verification_request_id: prepareJson.verification_request_id,
          storage_path: prepareJson.storage_path,
          storage_bucket: prepareJson.storage_bucket || "evidence",
          original_filename: file.name,
          mime: file.type || "application/octet-stream",
          size_bytes: file.size,
          evidence_type: normalizeEvidenceType(selectedEvidenceType),
          file_sha256: fileHash,
        }),
      });
      const confirmText = await confirmRes.text();
      let confirmJson: any = {};
      try {
        confirmJson = confirmText ? JSON.parse(confirmText) : {};
      } catch {
        confirmJson = {};
      }
      if (!confirmRes.ok) {
        throw new Error(
          String(confirmJson?.details || confirmJson?.error || confirmText || "No se pudo registrar la evidencia.").trim(),
        );
      }
      if (confirmJson?.processing?.deferred) {
        const evidenceLabel = getEvidenceTypeLabel(selectedEvidenceType);
        const targetContext = requiresExperience && selectedExperienceLabel
          ? ` para ${selectedExperienceLabel}`
          : requiresExperience
            ? " para la experiencia seleccionada"
            : " como evidencia global";
        setUploadMessage(
          `${evidenceLabel} subida correctamente${targetContext}. La hemos recibido y la estamos analizando.`,
        );
        setFile(null);
        window.location.reload();
        return;
      }
      const linkState = String(confirmJson?.documentary_processing?.link_state || "");
      const evidenceLabel = getEvidenceTypeLabel(selectedEvidenceType);
      const targetContext = requiresExperience && selectedExperienceLabel
        ? ` para ${selectedExperienceLabel}`
        : requiresExperience
          ? " para la experiencia seleccionada"
          : " como evidencia global";

      setUploadMessage(
        linkState === "auto_linked"
          ? `${evidenceLabel} subida correctamente${targetContext}. Ha quedado vinculada y aprobada.`
          : linkState === "suggested_review"
            ? `${evidenceLabel} subida correctamente${targetContext}. Está en proceso de validación.`
            : `${evidenceLabel} subida correctamente${targetContext}. Estamos revisándola.`,
      );
      setFile(null);
      window.location.reload();
    } catch (error: any) {
      setUploadMessage(error?.message || "No se pudo subir la evidencia.");
    } finally {
      setUploading(false);
    }
  }

  async function deleteEvidence(id: string) {
    const ok = window.confirm(
      "¿Seguro que quieres eliminar esta evidencia de tu panel?\n\nEl registro interno se conservará para trazabilidad."
    );
    if (!ok) return;

    setBusyId(id);
    try {
      const res = await fetch(`/api/candidate/evidence/${encodeURIComponent(id)}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "No se pudo eliminar la evidencia.");
      }
      setRemovedIds((prev) => new Set(prev).add(id));
    } catch (error: any) {
      alert(error?.message || "No se pudo eliminar la evidencia.");
    } finally {
      setBusyId(null);
    }
  }

  function hideEvidence(id: string) {
    const ok = window.confirm(
      "¿Seguro que quieres ocultar esta evidencia de tu panel?\n\nEl registro interno se conservará para trazabilidad."
    );
    if (!ok) return;

    const next = new Set(hiddenIds);
    next.add(id);
    setHiddenIds(next);
    writeHiddenIds(next);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900">Subir evidencia documental</h2>
        <p className="mt-2 text-sm text-gray-600">
          Selecciona primero el tipo de documento. Según el tipo, Verijob te pedirá asociarlo a una experiencia concreta o lo tratará como evidencia global.
        </p>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          {selectedTypeConfig?.helper}
        </div>
        {selectedEvidenceType === "vida_laboral" ? (
          <p className="mt-2 text-xs text-slate-600">
            La fe de vida laboral se trata como evidencia global: no se vincula a una sola experiencia y puede reforzar varias experiencias de tu historial.
          </p>
        ) : null}
        <p className="mt-2 text-xs font-medium text-indigo-700">
          Esta evidencia puede reforzar tu Trust Score.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Tipo de documento</label>
            <select
              value={selectedEvidenceType}
              onChange={(e) => setSelectedEvidenceType(normalizeEvidenceType(e.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              {EVIDENCE_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700">Documento</label>
            <input
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className={requiresExperience ? "" : "hidden"}>
            <label className="block text-xs font-semibold text-slate-700">Experiencia objetivo</label>
            <select
              value={selectedExperienceId}
              onChange={(e) => setSelectedExperienceId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              {experienceOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void uploadEvidence()}
            disabled={uploading}
            className="inline-flex rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {uploading ? "Subiendo evidencia..." : "Subir evidencia"}
          </button>
          <span className="text-xs text-slate-600">
            {requiresExperience
              ? "Se asociará a la experiencia seleccionada y quedará en validación."
              : "La fe de vida laboral se registra como evidencia global y puede reforzar varias experiencias."}
          </span>
        </div>
        {uploadMessage ? (
          <div className="mt-3 rounded-lg border border-blue-200 bg-white p-2 text-xs text-blue-900">{uploadMessage}</div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h3 className="text-base font-semibold text-gray-900">Evidencias subidas</h3>
        <p className="mt-2 text-sm text-gray-600">
          Estado visible para candidato: Aprobada, Rechazada o En proceso de validación.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          El impacto en Trust Score depende del tipo documental, la consistencia y la validación final.
        </p>
      </div>

      {visibleItems.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
          No hay evidencias visibles en tu panel.
        </div>
      ) : (
        <div className="space-y-3">
          {visibleItems.map((it) => (
            <article key={it.id} className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{it.document_name}</h3>
                  <p className="mt-1 text-xs text-gray-600">Tipo documental: {it.document_type}</p>
                  <p className="mt-1 text-xs text-gray-600">Cobertura: {it.scope_label}</p>
                  <p className="mt-1 text-xs text-gray-600">Asociación: {it.experience}</p>
                  <p className="mt-1 text-xs text-gray-600">Estado: {it.status}</p>
                  <p className="mt-1 text-xs text-gray-600">Procesamiento: {it.processing_label}</p>
                  <p className="mt-1 text-xs text-gray-600">Subida: {formatEsDate(it.created_at)}</p>
                  {it.reason ? <p className="mt-1 text-xs text-gray-600">Detalle: {it.reason}</p> : null}
                  {it.trust_label ? <p className="mt-1 text-xs font-medium text-indigo-700">{it.trust_label}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void deleteEvidence(it.id)}
                    disabled={busyId === it.id}
                    className="inline-flex rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                  >
                    {busyId === it.id ? "Eliminando..." : "Eliminar evidencia"}
                  </button>
                  <button
                    type="button"
                    onClick={() => hideEvidence(it.id)}
                    className="inline-flex rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                  >
                    Ocultar del listado
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
