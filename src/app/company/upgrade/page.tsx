"use client";

import React from "react";

export default function UpgradePage() {
  const handleSubscribe = async () => {
    const res = await fetch("/api/stripe/checkout", { method: "POST" });
    const data = await res.json();
    if (data?.url) window.location.href = data.url;
    else alert("No se pudo iniciar Checkout. Revisa /api/stripe/checkout.");
  };

  return (
    <main style={{ padding: 24, maxWidth: 760 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Activa tu suscripción</h1>
      <p style={{ marginBottom: 16 }}>
        Necesitas un plan activo para acceder a las funciones premium.
      </p>

      <button
        onClick={handleSubscribe}
        style={{
          padding: "12px 18px",
          borderRadius: 8,
          background: "black",
          color: "white",
          border: "none",
          cursor: "pointer",
        }}
      >
        Suscribirme ahora
      </button>
    </main>
  );
}
