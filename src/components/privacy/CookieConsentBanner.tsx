"use client";

import { useEffect, useMemo, useState } from "react";

type Consent = {
  v: 1;
  necessary: true;
  analytics: boolean;
  ts: number;
};

const STORAGE_KEY = "vj_cookie_consent_v1";

function readConsent(): Consent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Consent;
    if (parsed?.v !== 1 || parsed.necessary !== true) return null;
    if (typeof parsed.analytics !== "boolean") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeConsent(consent: Consent) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
}

export default function CookieConsentBanner() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  const initial = useMemo(() => {
    if (typeof window === "undefined") return null;
    return readConsent();
  }, []);

  useEffect(() => {
    setMounted(true);
    const existing = readConsent();
    if (!existing) {
      setOpen(true);
    } else {
      setOpen(false);
      setAnalytics(existing.analytics);
    }
  }, []);

  if (!mounted || !open) return null;

  const save = (allowAnalytics: boolean) => {
    writeConsent({
      v: 1,
      necessary: true,
      analytics: allowAnalytics,
      ts: Date.now(),
    });
    // Notificar al resto de la app (Analytics loader escucha esto)
    window.dispatchEvent(new CustomEvent("vj:consent-updated"));
    setOpen(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[9999] border-t bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-6 py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-gray-700">
            <p className="font-medium text-gray-900">Cookies</p>
            <p className="mt-1">
              Usamos cookies técnicas necesarias y, si lo aceptas, cookies analíticas (GA4) para mejorar el servicio.
              Puedes cambiar tu decisión en cualquier momento desde <a className="underline" href="/cookies">/cookies</a>.
            </p>

            <div className="mt-3 flex items-center gap-3">
              <span className="text-xs rounded-full bg-gray-100 px-2 py-1">Necesarias: siempre</span>

              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={analytics}
                  onChange={(e) => setAnalytics(e.target.checked)}
                />
                Analíticas (GA4)
              </label>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => save(false)}
              className="rounded-md border px-4 py-2 text-sm"
            >
              Rechazar analíticas
            </button>
            <button
              onClick={() => save(analytics)}
              className="rounded-md bg-black px-4 py-2 text-sm text-white"
            >
              Guardar
            </button>
            <button
              onClick={() => save(true)}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white"
            >
              Aceptar analíticas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
