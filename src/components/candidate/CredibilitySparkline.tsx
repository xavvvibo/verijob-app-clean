"use client";

import React, { useMemo } from "react";

export default function CredibilitySparkline({
  points,
  label = "Tendencia (30 días)",
}: {
  points: number[];
  label?: string;
}) {
  const d = useMemo(() => {
    if (!points?.length) return "";
    const w = 160;
    const h = 44;
    const pad = 4;

    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = Math.max(1, max - min);

    const xStep = (w - pad * 2) / Math.max(1, points.length - 1);

    const coords = points.map((p, i) => {
      const x = pad + i * xStep;
      const y = pad + (h - pad * 2) * (1 - (p - min) / span);
      return [x, y] as const;
    });

    const path = coords
      .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`))
      .join(" ");

    const area = `${path} L ${pad + (points.length - 1) * xStep} ${h - pad} L ${pad} ${h - pad} Z`;

    return { path, area, w, h };
  }, [points]);

  if (!d) return null;

  const last = points[points.length - 1] ?? 0;
  const first = points[0] ?? 0;
  const delta = last - first;

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="mt-1 text-sm font-medium text-gray-900">
          {delta >= 0 ? "+" : ""}
          {delta.toFixed(0)} pts
          <span className="text-gray-500 font-normal"> vs inicio</span>
        </div>
      </div>

      <div className="relative">
        <svg width={d.w} height={d.h} viewBox={`0 0 ${d.w} ${d.h}`} className="block">
          <path d={d.area} fill="currentColor" className="text-blue-100" />
          <path d={d.path} fill="none" strokeWidth="2.5" stroke="currentColor" className="text-blue-600" />
        </svg>
      </div>
    </div>
  );
}
