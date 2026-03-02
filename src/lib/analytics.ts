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

export function trackEvent(event: string, params?: Record<string, any>) {
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV !== "production") return;
  if (!hasAnalyticsConsent()) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (typeof w.gtag !== "function") return;

  w.gtag("event", event, { ...params });
}

/**
 * Eventos SaaS VERIJOB (F10)
 * Nombres estables: los marcamos luego como conversions en GA4 UI.
 */
export const vjEvents = {
  signup: (role: "candidate" | "company") => trackEvent("signup", { role }),
  onboarding_completed: (role: "candidate" | "company") =>
    trackEvent("onboarding_completed", { role }),

  verification_created: (verification_id: string) =>
    trackEvent("verification_created", { verification_id }),

  evidence_uploaded: (verification_id: string, evidence_id?: string) =>
    trackEvent("evidence_uploaded", { verification_id, evidence_id }),

  verification_shared: (verification_id: string, channel?: string) =>
    trackEvent("verification_shared", { verification_id, channel }),

  reuse_imported: (source_verification_id?: string) =>
    trackEvent("reuse_imported", { source_verification_id }),

  subscription_started: (plan?: string, interval?: string) =>
    trackEvent("subscription_started", { plan, interval }),
};
