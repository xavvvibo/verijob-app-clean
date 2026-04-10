"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const CV_NAME_DETECTED_EVENT = "candidate-cv-name-detected";

function splitFullName(value: string | null | undefined) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length <= 1) {
    return {
      firstName: parts[0] || "",
      lastName: "",
    };
  }
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

function composeFullName(firstName: string, lastName: string) {
  return [String(firstName || "").trim(), String(lastName || "").trim()].filter(Boolean).join(" ").trim();
}

function namesEquivalent(left: string, right: string) {
  const normalize = (input: string) =>
    String(input || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");
  return normalize(left) === normalize(right);
}

export default function OnboardingExperienceIdentityBlock({
  initialFullName,
}: {
  initialFullName: string | null;
}) {
  const router = useRouter();
  const initialSplit = useMemo(() => splitFullName(initialFullName), [initialFullName]);
  const [firstName, setFirstName] = useState(initialSplit.firstName);
  const [lastName, setLastName] = useState(initialSplit.lastName);
  const [savedFullName, setSavedFullName] = useState(composeFullName(initialSplit.firstName, initialSplit.lastName));
  const [suggestedFullName, setSuggestedFullName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "warning" | "error"; text: string } | null>(null);

  const currentFullName = composeFullName(firstName, lastName);
  const missingRequiredName = !String(firstName || "").trim() || !String(lastName || "").trim();

  async function saveName(nextFullName?: string) {
    const fullName = String(nextFullName || currentFullName).trim();
    const split = splitFullName(fullName);
    if (!split.firstName || !split.lastName) {
      setMessage({ tone: "error", text: "Introduce nombre y apellidos antes de continuar." });
      return false;
    }

    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/candidate/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ full_name: fullName }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(result?.details || result?.error || "No se pudo guardar el nombre."));
      }
      const persisted = String(result?.personal_profile?.full_name || fullName).trim();
      const persistedSplit = splitFullName(persisted);
      setFirstName(persistedSplit.firstName);
      setLastName(persistedSplit.lastName);
      setSavedFullName(persisted);
      setSuggestedFullName(null);
      setMessage({ tone: "success", text: "Nombre guardado correctamente." });
      router.refresh();
      return true;
    } catch (error: any) {
      setMessage({ tone: "error", text: error?.message || "No se pudo guardar el nombre." });
      return false;
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<any>).detail || {};
      const detected = String(detail?.fullName || "").trim();
      if (!detected) return;

      const detectedSplit = splitFullName(detected);
      if (!detectedSplit.firstName || !detectedSplit.lastName) return;

      const current = composeFullName(firstName, lastName);
      if (!current) {
        setFirstName(detectedSplit.firstName);
        setLastName(detectedSplit.lastName);
        setSuggestedFullName(detected);
        setMessage({ tone: "warning", text: "Hemos rellenado nombre y apellidos con lo detectado en tu CV. Revísalo y guárdalo." });
        return;
      }

      if (!namesEquivalent(current, detected) && !namesEquivalent(savedFullName, detected)) {
        setSuggestedFullName(detected);
        setMessage({ tone: "warning", text: "El CV trae un nombre distinto al guardado. Revísalo antes de continuar." });
      }
    };

    window.addEventListener(CV_NAME_DETECTED_EVENT, handler as EventListener);
    return () => window.removeEventListener(CV_NAME_DETECTED_EVENT, handler as EventListener);
  }, [firstName, lastName, savedFullName]);

  return (
    <section id="identity-block" data-testid="onboarding-identity-block" className="rounded-[28px] border border-blue-200 bg-blue-50/80 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Paso obligatorio</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">Confirma tu nombre antes de importar o revisar experiencias</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Este es el dato mínimo obligatorio del onboarding. Puedes importarlo desde tu CV, corregirlo aquí y guardarlo antes de continuar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void saveName()}
          disabled={saving}
          className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
        >
          {saving ? "Guardando…" : "Guardar nombre"}
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="block">
          <div className="text-sm font-semibold text-slate-900">Nombre</div>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Tu nombre"
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900"
          />
        </label>
        <label className="block">
          <div className="text-sm font-semibold text-slate-900">Apellidos</div>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Tus apellidos"
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${missingRequiredName ? "border-amber-300 bg-white text-amber-900" : "border-emerald-200 bg-white text-emerald-700"}`}>
          {missingRequiredName ? "Nombre y apellidos pendientes" : "Nombre mínimo confirmado"}
        </span>
        {suggestedFullName ? (
          <button
            type="button"
            onClick={() => {
              const split = splitFullName(suggestedFullName);
              setFirstName(split.firstName);
              setLastName(split.lastName);
            }}
            className="inline-flex rounded-xl border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-100"
          >
            Usar nombre detectado
          </button>
        ) : null}
        {suggestedFullName ? (
          <button
            type="button"
            onClick={() => void saveName(suggestedFullName)}
            disabled={saving}
            className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
          >
            Guardar nombre detectado
          </button>
        ) : null}
      </div>

      {suggestedFullName ? (
        <p className="mt-3 text-sm text-slate-700">
          Nombre detectado desde CV: <span className="font-semibold text-slate-900">{suggestedFullName}</span>
        </p>
      ) : null}

      {message ? (
        <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
          message.tone === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : message.tone === "error"
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
        }`}>
          {message.text}
        </div>
      ) : null}
    </section>
  );
}
