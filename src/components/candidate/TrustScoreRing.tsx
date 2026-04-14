import React, { useId } from "react";

type TrustScoreRingSize = "hero" | "card" | "compact";

function clamp(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function resolveTone(score: number) {
  if (score >= 90) {
    return {
      stroke: "#059669",
      strokeSecondary: "#34d399",
      track: "#d1fae5",
      glow: "rgba(16,185,129,0.24)",
      center: "from-emerald-50 via-white to-emerald-100/70",
      label: "Máxima confianza",
    };
  }
  if (score >= 80) {
    return {
      stroke: "#16a34a",
      strokeSecondary: "#4ade80",
      track: "#dcfce7",
      glow: "rgba(34,197,94,0.2)",
      center: "from-emerald-50 via-white to-emerald-100/70",
      label: "Alta confianza",
    };
  }
  if (score >= 60) {
    return {
      stroke: "#2563eb",
      strokeSecondary: "#60a5fa",
      track: "#dbeafe",
      glow: "rgba(37,99,235,0.22)",
      center: "from-blue-50 via-white to-sky-100/70",
      label: "Confianza visible",
    };
  }
  if (score >= 40) {
    return {
      stroke: "#f59e0b",
      strokeSecondary: "#fbbf24",
      track: "#fef3c7",
      glow: "rgba(245,158,11,0.22)",
      center: "from-amber-50 via-white to-amber-100/70",
      label: "Perfil en progreso",
    };
  }
  return {
    stroke: "#e11d48",
    strokeSecondary: "#fb7185",
    track: "#ffe4e6",
    glow: "rgba(225,29,72,0.18)",
    center: "from-rose-50 via-white to-rose-100/70",
    label: "Señal inicial",
  };
}

function resolveSize(size: TrustScoreRingSize) {
  if (size === "compact") {
    return { box: 56, svg: 56, center: 28, stroke: 5, radius: 21, scoreClass: "text-base", labelClass: "text-[9px]" };
  }
  if (size === "card") {
    return { box: 120, svg: 120, center: 60, stroke: 8, radius: 50, scoreClass: "text-2xl", labelClass: "text-[10px]" };
  }
  return { box: 228, svg: 228, center: 114, stroke: 12, radius: 97, scoreClass: "text-[3.15rem]", labelClass: "text-[11px]" };
}

export default function TrustScoreRing({
  score,
  label = "Trust score",
  stateTitle,
  size = "hero",
  className = "",
}: {
  score: number | null | undefined;
  label?: string;
  stateTitle?: string | null;
  size?: TrustScoreRingSize;
  className?: string;
}) {
  const safeScore = clamp(Number(score ?? 0));
  const tone = resolveTone(safeScore);
  const metrics = resolveSize(size);
  const circumference = 2 * Math.PI * metrics.radius;
  const offset = circumference - (safeScore / 100) * circumference;
  const gradientId = useId().replace(/:/g, "");

  return (
    <div
      className={`relative flex items-center justify-center rounded-full bg-white/95 ${className}`.trim()}
      style={{
        width: metrics.box,
        height: metrics.box,
        boxShadow: `0 0 0 1px rgba(226,232,240,0.92), 0 18px 44px ${tone.glow}`,
      }}
    >
      <svg
        width={metrics.svg}
        height={metrics.svg}
        viewBox={`0 0 ${metrics.svg} ${metrics.svg}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={tone.strokeSecondary} />
            <stop offset="100%" stopColor={tone.stroke} />
          </linearGradient>
        </defs>
        <circle
          cx={metrics.center}
          cy={metrics.center}
          r={metrics.radius}
          stroke={tone.track}
          strokeWidth={metrics.stroke}
          fill="transparent"
        />
        <circle
          cx={metrics.center}
          cy={metrics.center}
          r={metrics.radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={metrics.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          fill="transparent"
        />
      </svg>
      <div className={`absolute inset-[10%] flex flex-col items-center justify-center rounded-full bg-gradient-to-br ${tone.center} text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]`}>
        <div className={`font-semibold tabular-nums tracking-tight text-slate-950 ${metrics.scoreClass}`}>{safeScore}</div>
        <div className={`mt-1 font-semibold uppercase tracking-[0.16em] text-slate-500 ${metrics.labelClass}`}>{label}</div>
        {stateTitle ? (
          <div className="mt-1 max-w-[82%] text-[11px] font-medium leading-4 text-slate-600">{stateTitle}</div>
        ) : null}
      </div>
    </div>
  );
}
