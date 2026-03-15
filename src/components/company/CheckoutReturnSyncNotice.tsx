"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function CheckoutReturnSyncNotice({
  checkoutState,
  successMessage = "Pago recibido. Estamos actualizando tus accesos disponibles.",
}: {
  checkoutState: "success" | "cancel" | null;
  successMessage?: string;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(checkoutState === "success");

  useEffect(() => {
    if (checkoutState !== "success") {
      setSyncing(false);
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 4;
    const interval = window.setInterval(() => {
      if (cancelled) return;
      attempts += 1;
      router.refresh();
      if (attempts >= maxAttempts) {
        window.clearInterval(interval);
        setSyncing(false);
      }
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [checkoutState, router]);

  if (checkoutState === "cancel") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        La compra no se completó. Puedes intentarlo de nuevo cuando quieras.
      </div>
    );
  }

  if (checkoutState === "success") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        {syncing ? `${successMessage} La sincronización puede tardar unos segundos.` : successMessage}
      </div>
    );
  }

  return null;
}
