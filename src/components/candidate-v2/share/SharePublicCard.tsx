import React from "react";
import SharePublicCompactCard from "./SharePublicCompactCard";
import SharePublicFullCard from "./SharePublicFullCard";

type AnyProps = Record<string, any>;

function normalizeMode(raw: any): "compact" | "full" {
  const value = String(
    raw ??
      ""
  )
    .trim()
    .toLowerCase();

  const compactValues = new Set([
    "public",
    "summary",
    "compact",
    "public-summary",
    "public_summary",
    "public-compact",
    "public_compact",
    "resumida",
    "resumido",
    "vista pública resumida",
    "vista publica resumida",
    "public-visitor",
    "visitor",
    "preview-public",
    "preview_public",
  ]);

  const fullValues = new Set([
    "full",
    "complete",
    "public-full",
    "public_full",
    "public-complete",
    "public_complete",
    "completa",
    "completo",
    "vista completa",
    "vista pública completa",
    "vista publica completa",
    "preview-real",
    "preview_real",
    "real",
    "detailed",
  ]);

  if (compactValues.has(value)) return "compact";
  if (fullValues.has(value)) return "full";

  if (value.includes("resum")) return "compact";
  if (value.includes("compact")) return "compact";
  if (value.includes("summary")) return "compact";
  if (value.includes("public") && !value.includes("full")) return "compact";

  if (value.includes("full")) return "full";
  if (value.includes("complet")) return "full";
  if (value.includes("real")) return "full";
  if (value.includes("detail")) return "full";

  return "compact";
}

export default function SharePublicCard(props: AnyProps) {
  const rawMode =
    props?.mode ??
    props?.viewMode ??
    props?.selectedView ??
    props?.previewMode ??
    props?.variant ??
    props?.currentView ??
    props?.publicViewMode;

  const mode = normalizeMode(rawMode);

  if (mode === "compact") {
    return <SharePublicCompactCard {...props} />;
  }

  return <SharePublicFullCard {...props} />;
}
