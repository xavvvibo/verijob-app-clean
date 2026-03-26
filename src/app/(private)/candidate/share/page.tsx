"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CandidatePublicProfileRenderer,
  type PublicCandidatePayload,
  type PublicProfilePreviewMode,
} from "@/components/public/CandidatePublicProfileRenderer";
import { getCandidatePlanCapabilities } from "@/lib/billing/planCapabilities";
import CandidatePageHero from "../_components/CandidatePageHero";

type SettingsPayload = {
  allow_company_email_contact?: boolean;
  allow_company_phone_contact?: boolean;
};

type CandidateProfile = {
  email?: string | null;
  phone?: string | null;
};

type SubscriptionStatePayload = {
  subscription?: {
    plan?: string | null;
  } | null;
};

const PUBLIC_PROFILE_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "https://app.verijob.es";

const previewModes: Array<{ value: PublicProfilePreviewMode; label: string }> = [
  { value: "public", label: "Vista pública resumida" },
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
  const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(null);

  const link = useMemo(() => {
    if (!token) return null;
    return `${PUBLIC_PROFILE_ORIGIN}/p/${token}`;
  }, [token]);
  const qrSvgUrl = useMemo(() => {
    if (!token) return null;
    return `/api/public/candidate/${token}/qr.svg`;
  }, [token]);
  const planCapabilities = useMemo(() => getCandidatePlanCapabilities(subscriptionPlan), [subscriptionPlan]);

  const fetchPreview = useCallback(async (publicToken: string) => {
    const res = await fetch(`/api/public/candidate/${publicToken}?scope=internal`, { cache: "no-store" });
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
      const [profileRes, settingsRes, subscriptionRes] = await Promise.all([
        fetch("/api/candidate/profile", { credentials: "include" }).then((r) => r.json().catch(() => ({}))),
        fetch("/api/candidate/settings", { credentials: "include" }).then((r) => r.json().catch(() => ({}))),
        fetch("/api/account/subscription-state", { credentials: "include", cache: "no-store" }).then((r) =>
          r.json().catch(() => ({})) as Promise<SubscriptionStatePayload>
        ),
      ]);

      setProfile(profileRes?.profile || {});
      setSettings(settingsRes?.settings || {});
      setSubscriptionPlan(subscriptionRes?.subscription?.plan || null);
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
    <div className="mx-auto max-w-6xl space-y-14 px-6 py-10">
      <section className="space-y-8">
        <CandidatePageHero
          eyebrow="Perfil público"
          title="Comparte una versión clara y verificable de tu perfil"
          description="Esta pantalla funciona como una mini landing: muestra exactamente lo que verá una empresa cuando abras tu perfil público."
          badges={["Vista pública", "Enlace verificable", "Preview real"]}
          aside={
            <div className="flex flex-col gap-3 xl:items-end">
              <div className="min-w-[220px] rounded-xl bg-white/80 p-3">
                <label className="block text-sm font-semibold text-slate-900">Ver como</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as PublicProfilePreviewMode)}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {previewModes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={copyLink}
                disabled={!link}
                className="inline-flex justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition duration-150 hover:bg-black disabled:opacity-50"
              >
                Copiar enlace
              </button>
            </div>
          }
        />

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Vista previa real</div>
            <div className="rounded-2xl bg-slate-50/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
              {previewPayload ? (
                <CandidatePublicProfileRenderer
                  payload={previewPayload}
                  mode={mode}
                  companyAccess={false}
                  internalPreview
                  contact={contact}
                />
              ) : (
                <section className="rounded-2xl bg-white px-6 py-6 text-sm text-slate-600">
                  {previewError || "Generando enlace y cargando la vista pública real del perfil..."}
                </section>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl bg-slate-50/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
              <h3 className="text-lg font-semibold text-slate-900">Comparte tu perfil</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                El enlace público está listo y el QR aparece automáticamente si tu plan lo incluye.
              </p>

              <div className="mt-4 rounded-xl bg-white px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Enlace público</div>
                <p className="mt-2 break-all text-sm text-slate-700">{link || "https://app.verijob.es/p/[token]"}</p>
                <p className="mt-1 text-xs text-slate-500">Caduca en 7 días</p>
              </div>

              <div className="mt-4 rounded-xl bg-white px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">QR del perfil</div>
                <p className="mt-1 text-xs text-slate-600">
                  {planCapabilities.canShareByQr ? "Escanea para validar este perfil." : "Tu plan actual no incluye QR compartible."}
                </p>
                <div className="mt-3 flex min-h-[300px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-3">
                  {qrSvgUrl && planCapabilities.canShareByQr ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrSvgUrl} alt="QR de perfil público" className="h-auto w-full max-w-[220px] object-contain" />
                  ) : (
                    <span className="text-center text-xs text-slate-500">
                      {planCapabilities.canShareByQr
                        ? "Genera el enlace para ver el QR."
                        : "Mejora a Pro para compartir tu perfil también por QR."}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                {planCapabilities.canShareByQr ? (
                  <button
                    type="button"
                    onClick={downloadQr}
                    disabled={!qrSvgUrl}
                    className="inline-flex w-full justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Descargar QR
                  </button>
                ) : (
                  <Link
                    href="/candidate/subscription"
                    className="inline-flex w-full justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                  >
                    Mejorar a Pro
                  </Link>
                )}
                <button
                  type="button"
                  onClick={generateOrRefreshLink}
                  disabled={loadingLink}
                  className="inline-flex w-full justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                >
                  {loadingLink ? "Regenerando…" : "Regenerar enlace"}
                </button>
              </div>

              {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
            </div>

            <div className="rounded-2xl bg-white px-5 py-5 text-xs text-slate-600">
              <p className="font-semibold text-slate-900">Tu plan actual: {planCapabilities.label}</p>
              <p className="mt-2">Enlace público: {link ? "listo para compartir" : "pendiente de generar"}</p>
              <p className="mt-1">Compartir por link: sí</p>
              <p className="mt-1">Compartir por QR: {planCapabilities.canShareByQr ? "sí" : "no"}</p>
              <p className="mt-1">Descarga de CV verificado: {planCapabilities.canDownloadVerifiedCv ? "sí" : "no"}</p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
