"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  httpStatus: number;
  defaultMessage?: string;
};

export default function ReportIssueButton({ httpStatus, defaultMessage }: Props) {
  const [isOwner, setIsOwner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [okId, setOkId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const path = useMemo(() => {
    try { return location.pathname + location.search + location.hash; } catch { return ""; }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!mounted) return;
        setIsOwner(Boolean(data?.profile?.role === "owner"));
      } catch {
        if (!mounted) return;
        setIsOwner(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function report() {
    setBusy(true);
    setErr(null);
    setOkId(null);

    const requestId =
      (globalThis.crypto?.randomUUID?.() ?? `req_${Date.now()}_${Math.random().toString(16).slice(2)}`);

    const message_short =
      defaultMessage ??
      (httpStatus === 404 ? "404 en navegación (posible link roto)" : "500 inesperado en app");

    try {
      const res = await fetch("/api/admin/issues", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          severity: httpStatus === 500 ? "high" : "medium",
          http_status: httpStatus,
          error_code: httpStatus === 404 ? "NOT_FOUND" : "INTERNAL_ERROR",
          path,
          method: "GET",
          request_id: requestId,
          message_short,
          details_json: {
            ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
            referrer: typeof document !== "undefined" ? document.referrer : "",
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data?.error ?? "No se pudo registrar la incidencia.");
        return;
      }
      setOkId(String(data?.id ?? ""));
    } catch (e: any) {
      setErr(e?.message ?? "No se pudo registrar la incidencia.");
    } finally {
      setBusy(false);
    }
  }

  if (!isOwner) return null;

  return (
    <div className="mt-6">
      <button
        onClick={report}
        disabled={busy}
        className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "Reportando…" : "Reportar incidencia"}
      </button>

      {okId ? (
        <div className="mt-3 text-sm text-green-700">
          Incidencia registrada. ID: <span className="font-mono">{okId}</span>
        </div>
      ) : null}

      {err ? (
        <div className="mt-3 text-sm text-red-700">
          {err}
        </div>
      ) : null}
    </div>
  );
}
