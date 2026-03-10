"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CandidatePublicProfileRenderer,
  type PublicCandidatePayload,
  type PublicProfilePreviewMode,
} from "@/components/public/CandidatePublicProfileRenderer";

type SettingsPayload = {
  allow_company_email_contact?: boolean;
  allow_company_phone_contact?: boolean;
};

type CandidateProfile = {
  email?: string | null;
  phone?: string | null;
};

const PUBLIC_PROFILE_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "https://app.verijob.es";

const previewModes: Array<{ value: PublicProfilePreviewMode; label: string }> = [
  { value: "public", label: "Vista pública" },
  { value: "registered", label: "Vista empresa registrada" },
  { value: "requesting", label: "Vista empresa que solicita verificación" },
  { value: "full", label: "Vista completa" },
];

export default function CandidatePublicProfilePage() {
  const [mode, setMode] = useState<PublicProfilePreviewMode>("public");
  const [token, setToken] = useState<string | null>(null);
  const [loadingLink, setLoadingLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [previewPayload, setPreviewPayload] = useState<PublicCandidatePayload | null>(null);
  const [settings, setSettings] = useState<SettingsPayload>({});
  const [profile, setProfile] = useState<CandidateProfile>({});

  const link = useMemo(() => {
    if (!token) return null;
    return `${PUBLIC_PROFILE_ORIGIN}/p/${token}`;
  }, [token]);
  const qrSvgUrl = useMemo(() => {
    if (!token) return null;
    return `/api/public/candidate/${token}/qr.svg`;
  }, [token]);

  const fetchPreview = useCallback(async (publicToken: string) => {
    const res = await fetch(`/api/public/candidate/${publicToken}`, { cache: "no-store" });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(body?.error || "No se pudo cargar la vista pública.");
    }

    setPreviewPayload({ ...body, token: publicToken });
  }, []);

  const generateOrRefreshLink = useCallback(async () => {
    setLoadingLink(true);
    setError(null);
    setPreviewError(null);

    try {
      const res = await fetch("/api/candidate/public-link", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.token) {
        throw new Error(data?.error || "No se pudo generar el enlace.");
      }

      const nextToken = String(data.token);
      setToken(nextToken);
      await fetchPreview(nextToken);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "No se pudo generar el enlace.";
      setError(message);
      setPreviewError(message);
    } finally {
      setLoadingLink(false);
    }
  }, [fetchPreview]);

  useEffect(() => {
    void generateOrRefreshLink();

    (async () => {
      const [profileRes, settingsRes] = await Promise.all([
        fetch("/api/candidate/profile", { credentials: "include" }).then((r) => r.json().catch(() => ({}))),
        fetch("/api/candidate/settings", { credentials: "include" }).then((r) => r.json().catch(() => ({}))),
      ]);

      setProfile(profileRes?.profile || {});
      setSettings(settingsRes?.settings || {});
    })();
  }, [generateOrRefreshLink]);

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    alert("Enlace copiado");
  }

  async function downloadQr() {
    if (!qrSvgUrl || !token) return;

    const res = await fetch(qrSvgUrl, { cache: "no-store" });
    if (!res.ok) {
      setError("No se pudo generar el QR.");
      return;
    }

    const svgText = await res.text();
    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `verijob-perfil-publico-${token}.svg`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  const contact = useMemo(() => {
    if (mode !== "full") return undefined;

    return {
      email: settings.allow_company_email_contact ? profile.email || null : null,
      phone: settings.allow_company_phone_contact ? profile.phone || null : null,
    };
  }, [mode, settings.allow_company_email_contact, settings.allow_company_phone_contact, profile.email, profile.phone]);

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-gray-200 bg-white p-6">
        <h1 className="text-2xl font-semibold text-gray-900">Perfil público</h1>
        <p className="mt-2 text-sm text-gray-600">
          Así verán tu perfil las empresas cuando compartas tu enlace verificable.
        </p>

        <div className="mt-4 max-w-sm">
          <label className="block text-sm font-semibold text-gray-900">Ver como</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as PublicProfilePreviewMode)}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            {previewModes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
        Tu perfil no se muestra igual a todos los empleadores. Según el tipo de empresa y su nivel de acceso,
        Verijob protege tu privacidad y muestra más o menos señales verificables.
      </section>

      {previewPayload ? (
        <CandidatePublicProfileRenderer
          payload={previewPayload}
          mode={mode}
          companyAccess={false}
          contact={contact}
        />
      ) : (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
          {previewError || "Generando enlace y cargando vista previa real del perfil público..."}
        </section>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Enlace público</h3>
            <p className="mt-2 text-sm text-gray-600">{link || "https://app.verijob.es/p/[token]"}</p>
            <p className="mt-1 text-xs text-gray-500">Caduca en 7 días</p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copyLink}
                disabled={!link}
                className="inline-flex rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
              >
                Copiar enlace
              </button>
              <button
                type="button"
                onClick={generateOrRefreshLink}
                disabled={loadingLink}
                className="inline-flex rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {loadingLink ? "Regenerando…" : "Regenerar enlace"}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <h4 className="text-sm font-semibold text-gray-900">QR del perfil</h4>
            <p className="mt-1 text-xs text-gray-600">Escanéalo para abrir tu perfil público verificable.</p>

            <div className="mt-3 flex min-h-[180px] items-center justify-center rounded-lg border border-gray-200 bg-white p-3">
              {qrSvgUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrSvgUrl} alt="QR de perfil público" className="h-40 w-40 object-contain" />
              ) : (
                <span className="text-xs text-gray-500">Genera el enlace para ver el QR.</span>
              )}
            </div>

            <button
              type="button"
              onClick={downloadQr}
              disabled={!qrSvgUrl}
              className="mt-3 inline-flex w-full justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100 disabled:opacity-50"
            >
              Descargar QR
            </button>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </section>
    </div>
  );
}
