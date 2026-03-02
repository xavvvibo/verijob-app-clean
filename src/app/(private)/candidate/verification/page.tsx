"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

type UploadItem = {
  file: File;
  status: "queued" | "uploading" | "uploaded" | "error";
  error?: string;
};

export default function CandidateVerificationPage() {
  const supabase = useMemo(() => createClient(), []);
  const [files, setFiles] = useState<UploadItem[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);

  function validateFile(file: File): string | null {
    if (!ALLOWED_MIME.includes(file.type)) {
      return "Tipo no permitido. Solo PDF, JPG o PNG.";
    }

    if (file.size > MAX_SIZE_BYTES) {
      return "Archivo demasiado grande. Máximo 10MB.";
    }

    return null;
  }

  async function handleFiles(selected: FileList | null) {
    if (!selected) return;

    setGlobalError(null);

    const newItems: UploadItem[] = [];

    for (const file of Array.from(selected)) {
      const validationError = validateFile(file);

      if (validationError) {
        newItems.push({
          file,
          status: "error",
          error: validationError,
        });
        continue;
      }

      newItems.push({
        file,
        status: "queued",
      });
    }

    setFiles((prev) => [...prev, ...newItems]);
  }

  async function uploadFile(item: UploadItem, index: number) {
    if (item.status !== "queued") return;

    const updated = [...files];
    updated[index].status = "uploading";
    setFiles(updated);

    try {
      const res = await fetch("/api/candidate/evidence/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: item.file.name,
          fileType: item.file.type,
          fileSize: item.file.size,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error creando URL subida");
      }

      const { signedUrl } = await res.json();

      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": item.file.type,
        },
        body: item.file,
      });

      if (!uploadRes.ok) {
        throw new Error("Error subiendo archivo");
      }

      updated[index].status = "uploaded";
      setFiles([...updated]);
    } catch (err: any) {
      updated[index].status = "error";
      updated[index].error = err.message;
      setFiles([...updated]);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-10">
      <h1 className="text-2xl font-semibold mb-6">
        Subir evidencias
      </h1>

      <input
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={(e) => handleFiles(e.target.files)}
        className="mb-6"
      />

      {globalError && (
        <div className="text-red-600 mb-4">{globalError}</div>
      )}

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
                <div className="text-sm text-red-600 mt-1">
                  {item.error}
                </div>
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
              <span className="text-green-600 text-sm">
                Subido
              </span>
            )}

            {item.status === "error" && !item.error && (
              <span className="text-red-600 text-sm">
                Error
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
