"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function CompactTrustScoreBadge() {
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/candidate/trust-score", { credentials: "include", cache: "no-store" });
        const json = await response.json().catch(() => ({}));
        if (!response.ok || cancelled) return;
        setScore(Number(json?.score ?? 0));
      } catch {
        if (!cancelled) setScore(0);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const safeScore = useMemo(() => clampScore(score ?? 0), [score]);
  const progressStyle = {
    background: `conic-gradient(rgb(15 23 42) ${safeScore * 3.6}deg, rgb(219 234 254) 0deg)`,
  };

  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white/80 px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-sm">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full p-[4px] shadow-[0_0_18px_rgba(99,102,241,0.14)]"
        style={progressStyle}
      >
        <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-sm font-semibold text-slate-950">
          {score == null ? "…" : safeScore}
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Tu nivel de confianza</p>
        <p className="text-sm font-semibold text-slate-900">Trust score</p>
      </div>
    </div>
  );
}

export default function CandidatePageHero({
  eyebrow,
  title,
  description,
  ctaLabel,
  ctaHref,
  badges,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  badges?: string[];
  aside?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-50 via-blue-50/35 to-indigo-50/20 px-8 py-10 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-indigo-200/40 before:via-blue-200/50 before:to-cyan-200/40">
      <div className="relative grid gap-8 xl:grid-cols-[1fr_auto] xl:items-end">
        <div className="max-w-3xl space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
            <p className="text-base leading-7 text-slate-600">{description}</p>
          </div>
          {badges?.length ? (
            <div className="flex flex-wrap gap-2">
              {badges.map((badge) => (
                <span key={badge} className="rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 text-xs font-medium text-slate-700">
                  {badge}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 xl:items-end">
          <CompactTrustScoreBadge />
          {aside}
          {ctaLabel && ctaHref ? (
            <Link
              href={ctaHref}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition duration-150 hover:bg-black"
            >
              {ctaLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
