"use client";

import React from "react";

export default function BillingPortalButton() {
  const openPortal = async () => {
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    if (data?.url) window.location.href = data.url;
    else alert(data?.error || "No se pudo abrir el portal");
  };

  return (
    <button
      onClick={openPortal}
      style={{
        padding: "10px 16px",
        borderRadius: 8,
        background: "#111",
        color: "white",
        border: "none",
        cursor: "pointer",
      }}
    >
      Gestionar suscripción
    </button>
  );
}
