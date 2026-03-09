"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Preset = {
  title: string;
  description: string;
};

const HOW_TO_USE: Preset[] = [
  {
    title: "Recibe token o enlace verificable",
    description: "El candidato comparte un token seguro asociado a su perfil verificable.",
  },
  {
    title: "Abre el perfil completo",
    description: "Introduce el token para acceder a señales de credibilidad y detalle profesional.",
  },
  {
    title: "Evalúa y decide",
    description: "Revisa verificación, evidencias y disponibilidad antes de avanzar en contratación.",
  },
];

export const dynamic = "force-dynamic";

export default function CompanyCandidatesPage() {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const disabled = useMemo(() => token.trim().length === 0, [token]);

  function openCandidate(event: React.FormEvent) {
    event.preventDefault();
    const value = token.trim();
    if (!value) {
      setError("Introduce un token válido para abrir el candidato.");
      return;
    }
    setError(null);
    router.push(`/company/candidate/${encodeURIComponent(value)}`);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Candidatos</h1>
        <p className="mt-2 text-sm text-slate-600">
          Accede al perfil verificable completo de un candidato con su token compartido y evalúa su trayectoria con señales trazables.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Abrir candidato por token</h2>
          <form onSubmit={openCandidate} className="mt-4">
            <label className="block text-sm font-semibold text-slate-900">Token de candidato</label>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Pega aquí el token recibido"
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={disabled}
                className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
              >
                Abrir perfil candidato
              </button>
              <a href="/company/requests" className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                Revisar solicitudes
              </a>
            </div>
            {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
          </form>
        </article>

        <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-sm font-semibold text-slate-900">Cómo usar esta sección</h2>
          <ul className="mt-3 space-y-3">
            {HOW_TO_USE.map((item) => (
              <li key={item.title}>
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="text-sm text-slate-600">{item.description}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            La búsqueda avanzada y filtros por lote se habilitan en planes superiores para equipos con mayor volumen de contratación.
          </p>
        </aside>
      </section>
    </div>
  );
}
