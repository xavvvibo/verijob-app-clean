"use client";

import { useState } from "react";

type Props = {
  token: string;
  primaryCtaHref: string;
  primaryCtaLabel: string;
  secondaryCtaHref: string;
  secondaryCtaLabel: string;
};

export default function ResolveExperienceForm({
  token,
  primaryCtaHref,
  primaryCtaLabel,
  secondaryCtaHref,
  secondaryCtaLabel,
}: Props) {
  const [decision, setDecision] = useState<"confirm" | "reject">("confirm");
  const [verifierName, setVerifierName] = useState("");
  const [verifierRole, setVerifierRole] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const res = await fetch("/api/public/verification/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          decision,
          comment,
          verifier_name: verifierName,
          verifier_role: verifierRole,
          company_name: companyName || null,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "No se pudo registrar la respuesta.");
      }

      setDone(true);
    } catch (err: any) {
      setError(err?.message || "No se pudo registrar la respuesta.");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    const successTitle = decision === "confirm" ? "Verificación completada" : "Respuesta registrada";
    const successCopy =
      decision === "confirm"
        ? "Hemos registrado la confirmación de esta experiencia laboral."
        : "Hemos registrado el rechazo de esta experiencia laboral.";

    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <h2 className="text-lg font-semibold text-emerald-900">{successTitle}</h2>
        <p className="mt-2 text-sm text-emerald-800">
          {successCopy} Tu respuesta ha quedado guardada en VERIJOB para trazabilidad de esta experiencia.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={primaryCtaHref}
            className="inline-flex rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            {primaryCtaLabel}
          </a>
          <a
            href={secondaryCtaHref}
            className="inline-flex rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
          >
            {secondaryCtaLabel}
          </a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <label className="block text-sm font-medium text-slate-800">Resultado</label>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDecision("confirm")}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${decision === "confirm" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700"}`}
          >
            Confirmar experiencia
          </button>
          <button
            type="button"
            onClick={() => setDecision("reject")}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${decision === "reject" ? "border-rose-300 bg-rose-50 text-rose-800" : "border-slate-200 bg-white text-slate-700"}`}
          >
            Rechazar experiencia
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-slate-800">Nombre de quien verifica</span>
          <input
            value={verifierName}
            onChange={(e) => setVerifierName(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Nombre y apellidos"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-800">Cargo en la empresa</span>
          <input
            value={verifierRole}
            onChange={(e) => setVerifierRole(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Ej. Responsable de RR. HH."
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-slate-800">Nombre de empresa (opcional)</span>
        <input
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Si quieres, corrige el nombre mostrado"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-800">Comentario opcional</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Añade contexto si lo consideras necesario"
        />
      </label>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
      >
        {saving ? "Registrando..." : "Enviar respuesta"}
      </button>
    </form>
  );
}
