export function mapCandidateAvailability(value: unknown) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "buscando_activamente" || raw.includes("active")) return "Buscando activamente";
  if (raw === "abierto_oportunidades" || raw.includes("open")) return "Abierto a oportunidades";
  if (raw === "no_disponible" || raw.includes("not")) return "No disponible temporalmente";
  return "Disponibilidad no definida";
}
