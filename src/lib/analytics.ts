export function trackEvent(
  event: string,
  params?: Record<string, any>
) {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (typeof w.gtag !== "function") return;

  w.gtag("event", event, {
    ...params,
  });
}
