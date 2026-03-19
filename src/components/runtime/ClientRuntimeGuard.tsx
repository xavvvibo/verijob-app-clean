"use client";

import { useEffect } from "react";

const LOCALIZATION_ERROR_RE = /RegisterClientLocalizationsError|reading ['"]translations['"]|ACTIVE_LANGUAGES/i;
const RELOAD_FLAG = "__verijob_localization_reload__";

function shouldRecover(message: string) {
  return LOCALIZATION_ERROR_RE.test(message);
}

function recoverOnce() {
  if (typeof window === "undefined") return;
  try {
    if (window.sessionStorage.getItem(RELOAD_FLAG) === "1") return;
    window.sessionStorage.setItem(RELOAD_FLAG, "1");
  } catch {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set("_rt", String(Date.now()));
  window.location.replace(url.toString());
}

export default function ClientRuntimeGuard() {
  useEffect(() => {
    try {
      window.sessionStorage.removeItem(RELOAD_FLAG);
    } catch {}

    const handleError = (event: ErrorEvent) => {
      const message =
        String(event?.error?.message || "").trim() ||
        String(event?.message || "").trim();
      if (shouldRecover(message)) {
        console.error("ClientRuntimeGuard localization recovery", { message });
        recoverOnce();
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason: any = event?.reason;
      const message =
        String(reason?.message || "").trim() ||
        String(reason || "").trim();
      if (shouldRecover(message)) {
        console.error("ClientRuntimeGuard localization rejection recovery", { message });
        recoverOnce();
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
