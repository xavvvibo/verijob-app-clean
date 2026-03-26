import Link from "next/link";
import type { ReactNode } from "react";

import CandidateMetricPill from "./CandidateMetricPill";

export default function CandidatePageHeader({
  eyebrow,
  title,
  description,
  ctaLabel,
  ctaHref,
  badges,
  aside,
  variant,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
  badges?: Array<string | { label: string; value: string; tone?: "neutral" | "brand" | "success" | "warning" }>;
  aside?: ReactNode;
  variant?: "editorial" | "management";
}) {
  return (
    <header className={`space-y-5 ${variant === "management" ? "border-b border-slate-100 pb-8" : ""}`.trim()}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-[760px] space-y-3">
          {eyebrow ? <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p> : null}
          <h1 className="text-4xl font-bold tracking-tight text-slate-950">{title}</h1>
          {description ? <p className="max-w-[720px] text-base leading-7 text-slate-600">{description}</p> : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {aside}
          {ctaLabel && ctaHref ? (
            <Link
              href={ctaHref}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition duration-150 hover:bg-black"
            >
              {ctaLabel}
            </Link>
          ) : null}
        </div>
      </div>

      {badges?.length ? (
        <div className="flex flex-wrap gap-2.5">
          {badges.map((badge) =>
            typeof badge === "string" ? (
              <span key={badge} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                {badge}
              </span>
            ) : (
              <CandidateMetricPill key={`${badge.label}-${badge.value}`} label={badge.label} value={badge.value} tone={badge.tone} />
            ),
          )}
        </div>
      ) : null}
    </header>
  );
}
