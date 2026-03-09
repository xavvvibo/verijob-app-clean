"use client";

import { useMemo, useState } from "react";

type EvidenceItem = {
  id: string;
  document_name: string;
  experience: string;
  status: string;
  created_at: string | null;
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

export default function EvidenceListClient({ initialItems }: { initialItems: EvidenceItem[] }) {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => readHiddenIds());
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  const visibleItems = useMemo(
    () => initialItems.filter((item) => !hiddenIds.has(item.id) && !removedIds.has(item.id)),
    [initialItems, hiddenIds, removedIds]
  );

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
