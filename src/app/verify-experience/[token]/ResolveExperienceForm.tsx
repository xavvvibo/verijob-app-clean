"use client";

import { useState } from "react";

type Props = {
  token: string;
  experienceCompanyName: string;
  roleTitle: string;
  primaryCtaHref: string;
  primaryCtaLabel: string;
  secondaryCtaHref: string;
  secondaryCtaLabel: string;
};

type ResultState = {
  ok: boolean;
  status?: string;
  confidence?: {
    level?: string;
    score?: number;
    trust_score_awarded?: number;
    owner_attention_required?: boolean;
    verifier_email_domain?: string | null;
    match_note?: string | null;
  };
  error?: string;
  detail?: string;
};

export default function ResolveExperienceForm({
  token,
  experienceCompanyName,
  roleTitle,
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
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResultState | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/public/verification/resolve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          decision,
          verifier_name: verifierName,
          verifier_role: verifierRole,
          company_name: companyName,
          comment,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setResult({
          ok: false,
          error: json?.error || "resolve_failed",
          detail: json?.detail || null,
        });
        return;
      }

      setResult({
        ok: true,
        status: json?.status || null,
        confidence: json?.confidence || null,
      });
    } catch (error: any) {
      setResult({
        ok: false,
        error: "network_error",
        detail: String(error?.message || error),
      });
    } finally {
      setLoading(false);
    }
  }

  const isSuccess = Boolean(result?.ok);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900">Responder solicitud</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Indica si puedes confirmar esta experiencia. Cuanta mayor sea la coherencia entre empresa, dominio y validación, mayor será la confianza del resultado.
        </p>
      </div>

      {!isSuccess ? (
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setDecision("confirm")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                decision === "confirm"
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  : "border border-slate-300 bg-white text-slate-700"
              }`}
            >
              Confirmar experiencia
            </button>

            <button
              type="button"
              onClick={() => setDecision("reject")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                decision === "reject"
                  ? "bg-rose-100 text-rose-700 border border-rose-200"
                  : "border border-slate-300 bg-white text-slate-700"
              }`}
            >
              Rechazar experiencia
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Nombre de quien valida</label>
              <input
                value={verifierName}
                onChange={(e) => setVerifierName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                placeholder="Nombre y apellidos"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Cargo en la empresa</label>
              <input
                value={verifierRole}
                onChange={(e) => setVerifierRole(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                placeholder="Ej. Responsable de operaciones"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Nombre de empresa (opcional)</label>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              placeholder="Puedes corregir el nombre si procede"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Comentario (opcional)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[120px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              placeholder="Añade el contexto que consideres útil"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            Verijob registrará esta respuesta junto con la coherencia entre empresa, dominio y validador para estimar su nivel de confianza. Si la coincidencia no es alta, se recomendará documentación adicional.
          </div>

          {result && !result.ok ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              No se pudo registrar la respuesta. {result.detail || result.error}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Enviando..." : "Enviar respuesta"}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="text-base font-semibold text-emerald-900">
              Validación completada
            </div>
            <p className="mt-2 text-sm leading-6 text-emerald-800">
              Has confirmado una experiencia laboral en Verijob. Gracias a acciones como esta, las empresas pueden tomar mejores decisiones de contratación.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Empresa</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{experienceCompanyName}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Puesto</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{roleTitle}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-700">
            Verijob permite a empresas como la tuya acceder a perfiles con experiencia verificada, reduciendo errores en contratación y ahorrando tiempo en comprobaciones manuales.
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href={primaryCtaHref}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {primaryCtaLabel}
            </a>
            <a
              href={secondaryCtaHref}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {secondaryCtaLabel}
            </a>
          </div>

          <p className="text-sm text-slate-500">Empieza gratis. Sin compromiso.</p>
        </div>
      )}
    </section>
  );
}
