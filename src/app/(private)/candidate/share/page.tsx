"use client";

import { useEffect, useMemo, useState } from "react";

type PreviewMode = "guest" | "registered" | "requesting" | "full";

type TimelineItem = {
  source: "cv" | "verification";
  position?: string | null;
  company?: string | null;
  start?: string | null;
  end?: string | null;
  status?: string | null;
  company_confirmed?: boolean | null;
  is_revoked?: boolean | null;
};

type CandidateProfile = {
  full_name?: string | null;
  title?: string | null;
  location?: string | null;
  phone?: string | null;
  email?: string | null;
};

type SettingsPayload = {
  allow_company_email_contact?: boolean;
  allow_company_phone_contact?: boolean;
};

const PUBLIC_PROFILE_ORIGIN = process.env.NEXT_PUBLIC_PUBLIC_SITE_URL || "https://verijob.es";

function formatRange(start?: string | null, end?: string | null) {
  const s = start ? String(start).slice(0, 10) : null;
  const e = end ? String(end).slice(0, 10) : null;
  if (s && e) return `${s} → ${e}`;
  if (s && !e) return `${s} → Actualidad`;
  if (!s && e) return `Hasta ${e}`;
  return "Fechas no informadas";
}

function resolveExperienceState(item: TimelineItem): "Importado" | "Sin verificar" | "En verificación" | "Verificado" | "Revocado" {
  if (item.is_revoked) return "Revocado";
  const status = String(item.status || "").toLowerCase();
  if (status === "verified" || status === "approved" || item.company_confirmed) return "Verificado";
  if (
    status.includes("review") ||
    status.includes("pending") ||
    status.includes("sent") ||
    status.includes("waiting") ||
    status.includes("processing") ||
    item.source === "verification"
  ) {
    return "En verificación";
  }
  if (item.source === "cv") return "Importado";
  return "Sin verificar";
}

export default function CandidatePublicProfilePage() {
  const [mode, setMode] = useState<PreviewMode>("guest");
  const [token, setToken] = useState<string | null>(null);
  const [loadingLink, setLoadingLink] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<CandidateProfile>({});
  const [trustScore, setTrustScore] = useState(0);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [evidencesCount, setEvidencesCount] = useState(0);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [settings, setSettings] = useState<SettingsPayload>({});

  useEffect(() => {
    (async () => {
      const [profileRes, trustRes, timelineRes, settingsRes] = await Promise.all([
        fetch("/api/candidate/profile", { credentials: "include" }).then((r) => r.json().catch(() => ({}))),
        fetch("/api/candidate/trust-score", { credentials: "include" }).then((r) => r.json().catch(() => ({}))),
        fetch("/api/candidate/timeline", { credentials: "include" }).then((r) => r.json().catch(() => ({}))),
        fetch("/api/candidate/settings", { credentials: "include" }).then((r) => r.json().catch(() => ({}))),
      ]);

      setProfile(profileRes?.profile || {});
      setTrustScore(Number(trustRes?.trust_score || 0));
      setVerifiedCount(Number(trustRes?.breakdown?.approved || 0));
      setEvidencesCount(Number(trustRes?.breakdown?.evidences || 0));
      setTimeline(Array.isArray(timelineRes?.items) ? timelineRes.items : []);
      setSettings(settingsRes?.settings || {});
    })();
  }, []);

  const link = useMemo(() => {
    if (!token) return null;
    return `${PUBLIC_PROFILE_ORIGIN}/p/${token}`;
  }, [token]);

  async function generateLink() {
    setLoadingLink(true);
    setError(null);
    try {
      const res = await fetch("/api/candidate/public-link", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.token) {
        throw new Error(data?.error || "No se pudo generar el enlace.");
      }
      setToken(String(data.token));
    } catch (e: any) {
      setError(e?.message || "No se pudo generar el enlace.");
    } finally {
      setLoadingLink(false);
    }
  }

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    alert("Enlace copiado");
  }

  const visibleTimeline = useMemo(() => timeline.slice(0, mode === "guest" ? 2 : mode === "registered" ? 4 : 8), [timeline, mode]);

  const canSeeContact = mode === "full";
  const canSeeEvidences = mode === "registered" || mode === "requesting" || mode === "full";
  const canSeeVerifiableTimeline = mode === "requesting" || mode === "full";

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
            onChange={(e) => setMode(e.target.value as PreviewMode)}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="guest">Empresa no registrada</option>
            <option value="registered">Empresa registrada</option>
            <option value="requesting">Empresa que solicita verificación</option>
            <option value="full">Acceso completo</option>
          </select>
        </div>
      </header>

      <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
        Tu perfil no se muestra igual a todos los empleadores. Según el tipo de empresa y su nivel de acceso,
        Verijob protege tu privacidad y muestra más o menos señales verificables.
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Vista previa del perfil</h2>
            <p className="mt-1 text-sm text-gray-600">Modo actual: {mode === "guest" ? "Empresa no registrada" : mode === "registered" ? "Empresa registrada" : mode === "requesting" ? "Empresa que solicita verificación" : "Acceso completo"}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-xs text-gray-500">Trust Score</div>
            <div className="text-2xl font-semibold text-gray-900">{trustScore}%</div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Identidad visible</div>
            <div className="mt-1 text-sm font-semibold text-gray-900">{profile?.full_name || "Nombre no disponible"}</div>
            <div className="text-xs text-gray-600">{profile?.location || "Ubicación no especificada"}</div>
          </div>
          <div className="rounded-xl border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Experiencia verificada</div>
            <div className="mt-1 text-sm font-semibold text-gray-900">{verifiedCount}</div>
          </div>
          <div className="rounded-xl border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Evidencias visibles</div>
            <div className="mt-1 text-sm font-semibold text-gray-900">{canSeeEvidences ? evidencesCount : "Limitado"}</div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {visibleTimeline.length === 0 ? (
            <p className="text-sm text-gray-600">Aún no hay experiencias visibles para este modo.</p>
          ) : (
            visibleTimeline.map((item, idx) => {
              const state = resolveExperienceState(item);
              return (
                <article key={`${idx}-${item.position || "item"}`} className="rounded-xl border border-gray-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{item.position || "Puesto"} · {item.company || "Empresa"}</div>
                      <div className="text-xs text-gray-600">{formatRange(item.start, item.end)}</div>
                    </div>
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700">{state}</span>
                  </div>
                  {canSeeVerifiableTimeline ? (
                    <p className="mt-2 text-xs text-blue-700">Cronología verificable visible para este nivel de acceso.</p>
                  ) : null}
                </article>
              );
            })
          )}
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          {canSeeContact && (settings.allow_company_email_contact || settings.allow_company_phone_contact) ? (
            <div>
              <div className="font-semibold text-gray-900">Contacto visible</div>
              <div className="mt-1 text-xs text-gray-600">
                {settings.allow_company_email_contact ? `Email: ${profile.email || "No disponible"}` : "Email oculto"} · {settings.allow_company_phone_contact ? `Teléfono: ${profile.phone || "No disponible"}` : "Teléfono oculto"}
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-600">En este modo no se muestran métodos de contacto directo.</div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <h3 className="text-base font-semibold text-gray-900">Enlace público</h3>
        <p className="mt-2 text-sm text-gray-600">{link || "https://verijob.es/p/[token]"}</p>
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
            onClick={generateLink}
            disabled={loadingLink}
            className="inline-flex rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {loadingLink ? "Regenerando…" : "Regenerar enlace"}
          </button>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>
    </div>
  );
}
