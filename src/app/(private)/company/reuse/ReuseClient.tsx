"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function ReuseClient() {
  const sp = useSearchParams();
  const id = useMemo(() => sp.get("id") || sp.get("verification_id") || "", [sp]);

  const [value, setValue] = useState(id);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    const v = value.trim();
    if (!v) {
      setMsg("Pega un verification_id válido.");
      return;
    }
    setMsg(null);
    // mantenemos la misma ruta con query param
    const url = `/company/reuse?id=${encodeURIComponent(v)}`;
    window.location.href = url;
  }

  // Si NO hay id, mostramos selector
  if (!id) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-extrabold text-slate-900">Reutilizar verificación</h1>
        <p className="mt-2 text-slate-600">
          Para reutilizar, introduce el <span className="font-semibold">verification_id</span> de la verificación del candidato
          (por ejemplo, copiado desde “Solicitudes / Verificaciones”).
        </p>

        <div className="mt-6 max-w-xl rounded-2xl border border-slate-200 bg-white p-5">
          <label className="text-sm font-semibold text-slate-700">verification_id</label>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />

          {msg ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {msg}
            </div>
          ) : null}

          <div className="mt-4 flex gap-2">
            <button
              onClick={submit}
              className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:opacity-90"
            >
              Continuar
            </button>
            <a
              href="/company/requests"
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 hover:bg-slate-50"
            >
              Ir a Solicitudes
            </a>
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Nota: esta pantalla elimina el error “falta parámetro id” y hace el flujo robusto.
        </p>
      </div>
    );
  }

  // Si HAY id: aquí ya seguirá tu lógica existente (API /api/company/reuse)
  // Por ahora dejamos un placeholder seguro para no romper.
  return (
    <div className="p-6">
      <h1 className="text-2xl font-extrabold text-slate-900">Reutilizar verificación</h1>
      <p className="mt-2 text-slate-600">
        verification_id: <span className="font-mono text-slate-900">{id}</span>
      </p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-700">
          Listo para ejecutar reutilización. (Siguiente iteración: ejecutar POST a <span className="font-mono">/api/company/reuse</span>
          y mostrar resultado/estado).
        </p>

        <a
          href="/company/requests"
          className="mt-4 inline-flex rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 hover:bg-slate-50"
        >
          Volver a Solicitudes
        </a>
      </div>
    </div>
  );
}
