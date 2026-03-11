"use client";

import React from "react";

type VerificationStatus =
  | "pending_company"
  | "reviewing"
  | "verified"
  | "rejected"
  | "revoked"
  | "unknown";

function getStatusLabel(status: VerificationStatus) {
  if (status === "pending_company") return "Empresa pendiente";
  if (status === "reviewing") return "En verificación";
  if (status === "verified") return "Verificado";
  if (status === "rejected") return "Rechazada";
  if (status === "revoked") return "Revocada";
  return "Desconocido";
}

export default function CandidateVerificationsPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Verificaciones</h1>
      <p className="text-sm text-gray-600 mt-2">
        Aquí aparecerán tus solicitudes de verificación.
      </p>
    </div>
  );
}
