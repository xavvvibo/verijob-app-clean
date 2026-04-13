import React from "react";

type TrustScoreRingSize = "hero" | "card" | "compact";

function clamp(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function resolveTone(score: number) {
  if (score >= 80) {
    return {
      stroke: "#16a34a",
      track: "#dcfce7",
      glow: "rgba(34,197,94,0.18)",
      label: "Alta confianza",
    };
  }
  if (score >= 60) {
    return {
      stroke: "#2563eb",
      track: "#dbeafe",
      glow: "rgba(37,99,235,0.18)",
      label: "Confianza visible",
    };
  }
  if (score >= 40) {
    return {
      stroke: "#f59e0b",
      track: "#fef3c7",
      glow: "rgba(245,158,11,0.18)",
      label: "Perfil en progreso",
    };
  }
  return {
    stroke: "#64748b",
    track: "#e2e8f0",
    glow: "rgba(100,116,139,0.14)",
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
  return { box: 208, svg: 208, center: 104, stroke: 11, radius: 90, scoreClass: "text-[2.9rem]", labelClass: "text-[11px]" };
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

  return (
    <div
      className={`relative flex items-center justify-center rounded-full bg-white/92 ${className}`.trim()}
      style={{
        width: metrics.box,
        height: metrics.box,
        boxShadow: `0 0 0 1px rgba(226,232,240,0.9), 0 14px 34px ${tone.glow}`,
      }}
    >
      <svg
        width={metrics.svg}
        height={metrics.svg}
        viewBox={`0 0 ${metrics.svg} ${metrics.svg}`}
        className="-rotate-90"
        aria-hidden="true"
      >
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
          stroke={tone.stroke}
          strokeWidth={metrics.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          fill="transparent"
        />
      </svg>
      <div className="absolute inset-[10%] flex flex-col items-center justify-center rounded-full bg-white text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        <div className={`font-semibold tabular-nums tracking-tight text-slate-950 ${metrics.scoreClass}`}>{safeScore}</div>
        <div className={`mt-1 font-semibold uppercase tracking-[0.16em] text-slate-500 ${metrics.labelClass}`}>{label}</div>
        {stateTitle ? (
          <div className="mt-1 max-w-[82%] text-[11px] font-medium leading-4 text-slate-600">{stateTitle}</div>
        ) : null}
      </div>
    </div>
  );
}
