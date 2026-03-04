"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

export default function CompanyCandidatesPage() {
  const [token, setToken] = useState("");
  const router = useRouter();

  function go(e: React.FormEvent) {
    e.preventDefault();
    const t = token.trim();
    if (!t) return;
    router.push(`/company/candidate/${encodeURIComponent(t)}`);
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-extrabold text-slate-900">Candidatos</h1>
      <p className="mt-2 text-slate-600">
        Accede a un candidato pegando su token (share) para ver su perfil verificable.
      </p>

      <form onSubmit={go} className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <label className="block text-sm font-bold text-slate-900">Token de candidato</label>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Pega aquí el token..."
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
        <button className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:opacity-90">
          Abrir candidato
        </button>
      </form>
    </div>
  );
}
