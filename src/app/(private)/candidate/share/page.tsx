"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CandidatePresentationLayout from "@/components/candidate-v2/layouts/CandidatePresentationLayout";
import ShareHero from "@/components/candidate-v2/share/ShareHero";
import SharePublicCard from "@/components/candidate-v2/share/SharePublicCard";
import ShareQRCodePanel from "@/components/candidate-v2/share/ShareQRCodePanel";
import ShareVisibilitySummary from "@/components/candidate-v2/share/ShareVisibilitySummary";
import ShareActions from "@/components/candidate-v2/share/ShareActions";
import { getCandidatePlanCapabilities } from "@/lib/billing/planCapabilities";
import type { PublicCandidatePayload, PublicProfilePreviewMode } from "@/components/public/CandidatePublicProfileRenderer";

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

const PUBLIC_PROFILE_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL || "https://app.verijob.es";

const previewModes: Array<{
  value: PublicProfilePreviewMode;
  label: string;
}> = [
  { value: "public", label: "Vista pública resumida" },
  { value: "full", label: "Vista completa" },
];

export default function CandidatePublicProfilePage() {
  const [mode, setMode] = useState<PublicProfilePreviewMode>("public");
  const [token, setToken] = useState<string | null>(null);
  const [loadingLink, setLoadingLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [previewPayload, setPreviewPayload] =
    useState<PublicCandidatePayload | null>(null);
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

  const planCapabilities = useMemo(
    () => getCandidatePlanCapabilities(subscriptionPlan),
    [subscriptionPlan]
  );

  const fetchPreview = useCallback(async (publicToken: string) => {
    const res = await fetch(`/api/public/candidate/${publicToken}?scope=internal`, {
      cache: "no-store",
    });
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
      const message =
        e instanceof Error ? e.message : "No se pudo generar el enlace.";
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
        fetch("/api/candidate/profile", { credentials: "include" }).then((r) =>
          r.json().catch(() => ({}))
        ),
        fetch("/api/candidate/settings", { credentials: "include" }).then((r) =>
          r.json().catch(() => ({}))
        ),
        fetch("/api/account/subscription-state", {
          credentials: "include",
          cache: "no-store",
        }).then(
          (r) =>
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
    const blob = new Blob([svgText], {
      type: "image/svg+xml;charset=utf-8",
    });
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
  }, [
    mode,
    settings.allow_company_email_contact,
    settings.allow_company_phone_contact,
    profile.email,
    profile.phone,
  ]);

  const normalizedPreviewData = useMemo(() => {
    if (!previewPayload) return null;

    return {
      ...previewPayload,
      contact,
      token,
      mode,
    };
  }, [previewPayload, contact, token, mode]);

  return (
    <CandidatePresentationLayout>
      <section className="space-y-8">
        <ShareHero
          left={
            <div className="space-y-6">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Perfil público
              </p>

              <div className="space-y-3">
                <h1 className="text-4xl font-bold tracking-tight text-slate-950">
                  Comparte tu perfil verificable como una credencial profesional real
                </h1>
                <p className="max-w-[760px] text-base leading-7 text-slate-600">
                  Haz que empresas y contactos vean una versión clara, verificable y compartible de tu trayectoria con un solo enlace.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {["Vista pública", "Enlace verificable", "QR compartible"].map(
                  (badge) => (
                    <span
                      key={badge}
                      className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {badge}
                    </span>
                  )
                )}
              </div>
            </div>
          }
          right={
            <div className="flex w-full max-w-[390px] flex-col gap-3 xl:ml-auto">
              <div className="rounded-[24px] bg-slate-950 px-5 py-5 text-white shadow-[0_14px_34px_rgba(15,23,42,0.18)] ring-1 ring-white/10">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Acción principal
                </p>
                <h2 className="mt-3 text-xl font-semibold leading-tight">
                  Tu perfil ya puede jugar como activo compartible
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Copia el enlace y compártelo como tu versión profesional verificable.
                </p>
                <button
                  type="button"
                  onClick={copyLink}
                  disabled={!link || loadingLink}
                  className="mt-5 inline-flex w-full justify-center rounded-xl bg-white px-4 py-3.5 text-sm font-semibold text-slate-950 transition duration-150 hover:bg-slate-100 disabled:opacity-50"
                >
                  {loadingLink ? "Generando..." : "Copiar enlace público"}
                </button>
              </div>

              <div className="w-full rounded-2xl bg-white/85 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)] ring-1 ring-white/70">
                <label className="block text-sm font-semibold text-slate-900">
                  Ver como
                </label>
                <select
                  value={mode}
                  onChange={(e) =>
                    setMode(e.target.value as PublicProfilePreviewMode)
                  }
                  className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                >
                  {previewModes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          }
        />

        <div className="grid gap-10 xl:grid-cols-[minmax(0,1.16fr)_390px]">
          <div className="space-y-5">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Así verán tu perfil
            </div>

            <SharePublicCard mode={mode} data={normalizedPreviewData}>
              {!normalizedPreviewData ? (
                <section className="rounded-2xl bg-white px-6 py-6 text-sm text-slate-600">
                  {previewError ||
                    "Generando enlace y cargando la vista pública real del perfil..."}
                </section>
              ) : null}
            </SharePublicCard>
          </div>

          <aside className="space-y-4">
            <ShareVisibilitySummary>
              <h3 className="text-lg font-semibold text-slate-900">
                Comparte tu perfil verificable
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Tu enlace público ya está listo para compartir. Si tu plan lo permite, también puedes usar QR para llevarlo fuera de VERIJOB.
              </p>

              <div className="mt-4 rounded-2xl bg-white px-4 py-4 ring-1 ring-slate-200/70">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Enlace compartible
                </div>
                <p className="mt-2 break-all text-sm text-slate-700">
                  {link || "https://app.verijob.es/p/[token]"}
                </p>
                <p className="mt-1 text-xs text-slate-500">Caduca en 7 días para mantener el control sobre tu perfil compartido.</p>
              </div>
            </ShareVisibilitySummary>

            <ShareQRCodePanel>
              <div className="rounded-2xl bg-white px-4 py-4 ring-1 ring-slate-200/70">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  QR del perfil
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {planCapabilities.canShareByQr
                    ? "Escanea para validar este perfil."
                    : "Tu plan actual no incluye QR compartible."}
                </p>

                <div className="mt-3 flex min-h-[320px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4">
                  {qrSvgUrl && planCapabilities.canShareByQr ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrSvgUrl}
                      alt="QR de perfil público"
                      className="h-auto w-full max-w-[220px] object-contain"
                    />
                  ) : (
                    <span className="text-center text-xs text-slate-500">
                      {planCapabilities.canShareByQr
                        ? "Genera el enlace para ver el QR."
                        : "Mejora a Pro para compartir tu perfil también por QR."}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <ShareActions>
                  <details className="w-full">
                    <summary className="inline-flex w-full list-none items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 cursor-pointer">
                      Más acciones de distribución
                    </summary>
                    <div className="mt-3 grid gap-2">
                      {planCapabilities.canShareByQr ? (
                        <button
                          type="button"
                          onClick={downloadQr}
                          disabled={!qrSvgUrl}
                          className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                          Descargar QR
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 opacity-60"
                        >
                          Mejorar a Pro para QR
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => void generateOrRefreshLink()}
                        className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                      >
                        Regenerar enlace
                      </button>
                    </div>
                  </details>
                </ShareActions>
              </div>
            </ShareQRCodePanel>

            <ShareVisibilitySummary>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Plan y distribución</p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">Plan actual: {subscriptionPlan || "Free"}</h3>
                </div>
                <div className="grid gap-2">
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">Enlace público listo para compartir</div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">Compartir por QR: {planCapabilities.canShareByQr ? "sí" : "no"}</div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">CV verificado descargable: {((planCapabilities as any)?.canDownloadCv ?? false) ? "sí" : "no"}</div>
                </div>
              </div>
            </ShareVisibilitySummary>

            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}
          </aside>
        </div>
      </section>
    </CandidatePresentationLayout>
  );
}
