"use client";

import { useEffect } from "react";

const STORAGE_KEY = "vj_cookie_consent_v1";

function hasAnalyticsConsent(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const c = JSON.parse(raw);
    return c?.v === 1 && c?.necessary === true && c?.analytics === true;
  } catch {
    return false;
  }
}

function ensureGtag(measurementId: string) {
  // Minimal gtag bootstrap
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  w.gtag =
    w.gtag ||
    function gtag() {
      w.dataLayer.push(arguments);
    };

  w.gtag("js", new Date());
  w.gtag("config", measurementId, { anonymize_ip: true });
}

function loadScriptOnce(src: string, id: string) {
  if (document.getElementById(id)) return;
  const s = document.createElement("script");
  s.id = id;
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

export default function Ga4Client() {
  useEffect(() => {
    const measurementId = process.env.NEXT_PUBLIC_GA4_ID;
    if (!measurementId) return;

    const apply = () => {
      if (!hasAnalyticsConsent()) return;

      loadScriptOnce(`https://www.googletagmanager.com/gtag/js?id=${measurementId}`, "vj-ga4");
      ensureGtag(measurementId);
    };

    // 1) aplicar al cargar
    apply();

    // 2) aplicar cuando el usuario cambie consentimiento
    const onConsent = () => apply();
    window.addEventListener("vj:consent-updated", onConsent);

    // 3) Eventos mínimos: clicks a signup con role
    const onClickCapture = (ev: MouseEvent) => {
      const t = ev.target as HTMLElement | null;
      const a = t?.closest?.("a") as HTMLAnchorElement | null;
      if (!a) return;

      const href = a.getAttribute("href") || "";
      const m = href.match(/\/signup\?role=(candidate|company)/);
      if (!m) return;

      if (!hasAnalyticsConsent()) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      if (typeof w.gtag !== "function") return;

      w.gtag("event", "signup_click", {
        role: m[1],
        href,
      });
    };

    document.addEventListener("click", onClickCapture, true);

    return () => {
      window.removeEventListener("vj:consent-updated", onConsent);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  return null;
}
