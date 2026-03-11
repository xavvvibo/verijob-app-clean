"use client";

import { useMemo, useState } from "react";
import { resolveEvidenceEmploymentRecordId } from "@/lib/candidate/evidence-linkage";

type EvidenceItem = {
  id: string;
  document_name: string;
  experience: string;
  status: string;
  created_at: string | null;
};

type ExperienceOption = {
  id: string;
  label: string;
};

const STORAGE_KEY = "candidate_hidden_evidence_ids_v1";

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
  const [file, setFile] = useState<File | null>(null);

  const visibleItems = useMemo(
    () => initialItems.filter((item) => !hiddenIds.has(item.id) && !removedIds.has(item.id)),
    [initialItems, hiddenIds, removedIds]
  );

  async function uploadEvidence() {
    if (!file) {
      setUploadMessage("Selecciona un documento para subir.");
      return;
    }
    if (!selectedExperienceId) {
      setUploadMessage("Selecciona una experiencia para asociar la evidencia.");
      return;
    }

    setUploading(true);
    setUploadMessage(null);
    try {
      const { guessedId: guessedExperienceId, employmentRecordId } = resolveEvidenceEmploymentRecordId({
        filename: file.name,
        options: experienceOptions,
        selectedExperienceId,
      });
      const fileHash = await sha256Hex(file);

      const uploadUrlRes = await fetch("/api/candidate/evidence/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          employment_record_id: employmentRecordId,
          mime: file.type || "application/octet-stream",
          size_bytes: file.size,
          filename: file.name,
          evidence_type: "documentary",
          file_sha256: fileHash,
        }),
      });
      const uploadUrlJson = await uploadUrlRes.json().catch(() => ({}));
      if (!uploadUrlRes.ok || !uploadUrlJson?.signed_url || !uploadUrlJson?.storage_path || !uploadUrlJson?.verification_request_id) {
        throw new Error(uploadUrlJson?.error || "No se pudo preparar la subida del documento.");
      }

      const uploadRes = await fetch(uploadUrlJson.signed_url, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!uploadRes.ok) {
        throw new Error("No se pudo subir el archivo al almacenamiento.");
      }

      const confirmRes = await fetch("/api/candidate/evidence/confirm", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          verification_request_id: uploadUrlJson.verification_request_id,
          storage_path: uploadUrlJson.storage_path,
          evidence_type: "documentary",
          file_sha256: fileHash,
        }),
      });
      const confirmJson = await confirmRes.json().catch(() => ({}));
      if (!confirmRes.ok) {
        throw new Error(confirmJson?.error || "No se pudo registrar la evidencia.");
      }
      const linkState = String(confirmJson?.documentary_processing?.link_state || "");

      setUploadMessage(
        linkState === "auto_linked"
          ? guessedExperienceId
            ? "Evidencia subida y vinculada automáticamente a la experiencia detectada."
            : "Evidencia subida y vinculada automáticamente a la experiencia seleccionada."
          : linkState === "suggested_review"
            ? "Evidencia subida. Coincidencia parcial detectada: queda pendiente de revisión manual."
            : "Evidencia subida. No se ha podido vincular automáticamente; revisa la experiencia objetivo."
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
        <h2 className="text-base font-semibold text-gray-900">Documentos de verificación</h2>
        <p className="mt-2 text-sm text-gray-600">
          Aquí solo se muestran evidencias documentales de verificación. El CV no aparece en este listado.
        </p>
        <p className="mt-1 text-xs text-blue-700">Sube una evidencia para reforzar esta experiencia y acelerar su validación.</p>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <h3 className="text-sm font-semibold text-blue-900">Subir evidencia documental</h3>
        <p className="mt-1 text-xs text-blue-800">
          Verijob intentará asociar automáticamente el documento a la experiencia más probable. Si no detecta coincidencia, se utilizará la experiencia seleccionada.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700">Documento</label>
            <input
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
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
            {uploading ? "Subiendo evidencia..." : "Subir y asociar evidencia"}
          </button>
          <span className="text-xs text-slate-600">Si la asociación automática falla, quedará vinculada con la experiencia seleccionada.</span>
        </div>
        {uploadMessage ? (
          <div className="mt-3 rounded-lg border border-blue-200 bg-white p-2 text-xs text-blue-900">{uploadMessage}</div>
        ) : null}
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
                  <p className="mt-1 text-xs text-gray-600">Vinculada a: {it.experience}</p>
                  <p className="mt-1 text-xs text-gray-600">Estado: {it.status}</p>
                  <p className="mt-1 text-xs text-gray-600">Subida: {formatEsDate(it.created_at)}</p>
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
