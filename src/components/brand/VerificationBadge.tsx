import React from "react";

export type VerificationBadgeTone =
  | "profile_verified"
  | "company_verified"
  | "documentary"
  | "business"
  | "trust_visible"
  | "in_progress";

const TONE_STYLES: Record<VerificationBadgeTone, string> = {
  profile_verified: "border-emerald-200 bg-emerald-50 text-emerald-800",
  company_verified: "border-blue-200 bg-blue-50 text-blue-800",
  documentary: "border-indigo-200 bg-indigo-50 text-indigo-800",
  business: "border-sky-200 bg-sky-50 text-sky-800",
  trust_visible: "border-violet-200 bg-violet-50 text-violet-800",
  in_progress: "border-amber-200 bg-amber-50 text-amber-800",
};

export function VerificationBadge({
  tone,
  children,
  className = "",
}: {
  tone: VerificationBadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide ${TONE_STYLES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function TrustLevelBadge({ score }: { score: number }) {
  if (score >= 80) return <VerificationBadge tone="profile_verified">Perfil verificado</VerificationBadge>;
  if (score >= 60) return <VerificationBadge tone="business">Verificación empresarial</VerificationBadge>;
  if (score >= 40) return <VerificationBadge tone="documentary">Verificación documental</VerificationBadge>;
  return <VerificationBadge tone="in_progress">Credibilidad en desarrollo</VerificationBadge>;
}
