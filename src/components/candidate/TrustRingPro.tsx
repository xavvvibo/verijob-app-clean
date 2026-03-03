"use client";

import React, { useMemo } from "react";

function clamp(n: number, a = 0, b = 100) {
  return Math.max(a, Math.min(b, n));
}

function scoreTone(score: number) {
  if (score >= 85) return { ring: "stroke-green-600", badge: "bg-green-50 text-green-700 border-green-100", label: "Profesional validado" };
  if (score >= 70) return { ring: "stroke-green-500", badge: "bg-green-50 text-green-700 border-green-100", label: "Alta confianza" };
  if (score >= 40) return { ring: "stroke-blue-600", badge: "bg-blue-50 text-blue-700 border-blue-100", label: "Verificado" };
  return { ring: "stroke-gray-400", badge: "bg-gray-50 text-gray-700 border-gray-200", label: "Inicial" };
}

export default function TrustRingPro({
  score,
  breakdown,
}: {
  score: number;
  breakdown: { real: number; approved: number; valid: number };
}) {
  const radius = 92;
  const stroke = 14;
  const normalized = radius - stroke * 0.5;
  const circumference = normalized * 2 * Math.PI;

  const s = clamp(score);
  const offset = circumference - (s / 100) * circumference;

  const tone = useMemo(() => scoreTone(s), [s]);

  const items = useMemo(
    () => [
      { k: "R", label: "Experiencias reales", v: clamp(breakdown.real) },
      { k: "A", label: "Aprobaciones", v: clamp(breakdown.approved) },
      { k: "V", label: "Vigencia", v: clamp(breakdown.valid) },
    ],
    [breakdown]
  );

  return (
    <div className="flex flex-col sm:flex-row items-center gap-8">
      <div className="relative w-64 h-64 flex items-center justify-center">
        <svg height="224" width="224" className="rotate-[-90deg]">
          <circle stroke="#e5e7eb" fill="transparent" strokeWidth={stroke} r={normalized} cx="112" cy="112" />
          <circle
            strokeLinecap="round"
            className={`${tone.ring} transition-all duration-700`}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            r={normalized}
            cx="112"
            cy="112"
          />
        </svg>

        {/* NO número. Solo “estado” + microcopy */}
        <div className="absolute text-center px-6">
          <div className={`inline-flex px-3 py-1 rounded-full border text-xs font-semibold ${tone.badge}`}>
            {tone.label}
          </div>
          <div className="mt-3 text-sm text-gray-600 leading-snug">
            Score calculado por verificaciones reales y consistencia de evidencias.
          </div>
        </div>
      </div>

      <div className="w-full space-y-4">
        <div className="text-sm text-gray-700">
          Desglose del scoring
          <span className="text-gray-500"> (ponderado)</span>
        </div>

        <div className="grid gap-3">
          {items.map((it) => (
            <div key={it.k} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-gray-100 text-gray-800 font-semibold">
                    {it.k}
                  </span>
                  <span className="text-gray-700 font-medium">{it.label}</span>
                </div>
                <span className="tabular-nums">{it.v}%</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${it.v}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-gray-500">
          Consejo: subir foto + completar titular profesional mejora tasa de respuesta y prepara tu CV verificado.
        </div>
      </div>
    </div>
  );
}
