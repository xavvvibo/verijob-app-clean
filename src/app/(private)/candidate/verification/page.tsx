"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { trackEvent, vjEvents } from "@/lib/analytics";

const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB (alineado con API)

type UploadItem = {
  file: File;
  status: "queued" | "uploading" | "uploaded" | "error";
  error?: string;
};

function validateFile(file: File): string | null {
  if (!ALLOWED_MIME.includes(file.type)) return "Tipo no permitido. Solo PDF, JPG, PNG o WEBP.";
  if (file.size > MAX_SIZE_BYTES) return "Archivo demasiado grande. Máximo 20MB.";
  return null;
}

function onceKey(name: string) {
  return `vj_once_${name}`;
}

export default function CandidateVerificationPage() {
  const supabase = useMemo(() => createClient(), []);
  const sp = useSearchParams();

  const [files, setFiles] = useState<UploadItem[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [vrId, setVrId] = useState<string | null>(null);
  const [vrLoading, setVrLoading] = useState(true);

  // 1) Determinar verification_request_id:
  //    - Prioridad: ?id= / ?verification_request_id=
  //    - Fallback: último verification_requests del usuario (created_at desc)
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        setVrLoading(true);
        setGlobalError(null);

        const fromUrl = sp.get("id") || sp.get("verification_request_id");
        if (fromUrl) {
          if (!cancelled) setVrId(fromUrl);
          return;
        }

        const { data: au } = await supabase.auth.getUser();
        if (!au.user) {
          if (!cancelled) setGlobalError("No autenticado. Ve a /login.");
          return;
        }

        const { data, error } = await supabase
          .from("verification_requests")
          .select("id, created_at")
          .eq("requested_by", au.user.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (error) {
          if (!cancelled) setGlobalError("No se pudo cargar tu verificación. Recarga.");
          return;
        }

        const id = data?.[0]?.id as string | undefined;
        if (!id) {
          if (!cancelled) setGlobalError("Aún no tienes verificaciones para subir evidencias.");
          return;
        }

        if (!cancelled) setVrId(id);
      } finally {
        if (!cancelled) setVrLoading(false);
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [sp, supabase]);

  // 2) Emitir verification_created (1 vez por verification_request_id)
  useEffect(() => {
    if (!vrId) return;
    const k = onceKey(`verification_created:${vrId}`);
    try {
      if (localStorage.getItem(k) === "1") return;
      localStorage.setItem(k, "1");
      vjEvents.verification_created(vrId);
    } catch {
      // noop
    }
  }, [vrId]);

  async function handleFiles(selected: FileList | null) {
    if (!selected) return;
    setGlobalError(null);

    const newItems: UploadItem[] = [];
    for (const file of Array.from(selected)) {
      const validationError = validateFile(file);
      if (validationError) {
        newItems.push({ file, status: "error", error: validationError });
      } else {
        newItems.push({ file, status: "queued" });
      }
    }
    setFiles((prev) => [...prev, ...newItems]);
  }

  async function uploadFile(item: UploadItem, index: number) {
    if (item.status !== "queued") return;

    if (!vrId) {
      setGlobalError("Falta verification_request_id (VRID).");
      return;
    }

    const updated = [...files];
    updated[index].status = "uploading";
    setFiles(updated);

    try {
      // A) pedir signed upload url (API contract real)
      const res = await fetch("/api/candidate/evidence/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          verification_request_id: vrId,
          mime: item.file.type,
          size_bytes: item.file.size,
          filename: item.file.name,
          evidence_type: null,
          file_sha256: null,
        }),
      });

      const up = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(up?.error || "Error creando URL subida");

      const signedUrl = up?.signed_url as string | undefined;
      const storagePath = up?.storage_path as string | undefined;
      if (!signedUrl || !storagePath) throw new Error("Respuesta inválida de upload-url");

      // B) subir binario a storage (PUT)
      const put = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": item.file.type },
        body: item.file,
      });
      if (!put.ok) throw new Error("Error subiendo archivo");

      // C) confirmar en DB (INSERT evidences)
      const conf = await fetch("/api/candidate/evidence/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          verification_request_id: vrId,
          storage_path: storagePath,
          evidence_type: null,
          file_sha256: null,
        }),
      });

      const confJson = await conf.json().catch(() => ({}));
      if (!conf.ok) throw new Error(confJson?.error || "Error confirmando evidencia");

      const evidenceId = confJson?.evidence?.id;

      updated[index].status = "uploaded";
      setFiles([...updated]);

      // ✅ F10 evento: evidence_uploaded (bien)
      trackEvent("evidence_uploaded", {
        verification_id: vrId,
        evidence_id: evidenceId || null,
        file_name: item.file.name,
        file_type: item.file.type,
        file_size: item.file.size,
      });
    } catch (err: any) {
      updated[index].status = "error";
      updated[index].error = err?.message || "Error";
      setFiles([...updated]);
    }
  }

  if (vrLoading) {
    return (
      <div className="max-w-2xl mx-auto py-10">
        <h1 className="text-2xl font-semibold mb-2">Subir evidencias</h1>
        <div className="text-sm text-gray-600">Cargando…</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-10">
      <h1 className="text-2xl font-semibold mb-2">Subir evidencias</h1>
      <div className="text-xs text-gray-500 mb-6">
        VRID: {vrId || "—"}
      </div>

      {globalError && (
        <div className="text-red-600 mb-4">{globalError}</div>
      )}

      <input
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        onChange={(e) => handleFiles(e.target.files)}
        className="mb-6"
      />

      <div className="space-y-4">
        {files.map((item, index) => (
          <div
            key={index}
            className="border p-4 rounded flex justify-between items-center"
          >
            <div>
              <div className="font-medium">{item.file.name}</div>
              <div className="text-sm text-gray-500">
                {(item.file.size / 1024 / 1024).toFixed(2)} MB
              </div>
              {item.error && (
                <div className="text-sm text-red-600 mt-1">{item.error}</div>
              )}
            </div>

            {item.status === "queued" && (
              <button
                onClick={() => uploadFile(item, index)}
                className="px-4 py-2 bg-black text-white rounded"
              >
                Subir
              </button>
            )}

            {item.status === "uploading" && (
              <span className="text-sm">Subiendo...</span>
            )}

            {item.status === "uploaded" && (
              <span className="text-green-600 text-sm">Subido</span>
            )}

            {item.status === "error" && !item.error && (
              <span className="text-red-600 text-sm">Error</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
