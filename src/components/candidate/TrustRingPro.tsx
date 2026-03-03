"use client";

import React, { useMemo } from "react";

function clamp(n: number, a = 0, b = 100) {
  return Math.max(a, Math.min(b, n));
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

  const ringClass =
    s >= 85 ? "stroke-green-600" :
    s >= 70 ? "stroke-green-500" :
    s >= 40 ? "stroke-blue-600" :
    "stroke-gray-400";

  const badge =
    s >= 85 ? "bg-green-50 text-green-700 border-green-100" :
    s >= 70 ? "bg-green-50 text-green-700 border-green-100" :
    s >= 40 ? "bg-blue-50 text-blue-700 border-blue-100" :
    "bg-gray-50 text-gray-700 border-gray-200";

  const level =
    s >= 85 ? "Profesional validado" :
    s >= 70 ? "Alta confianza" :
    s >= 40 ? "Verificado" :
    "Inicial";

  const items = useMemo(() => ([
    { k: "R", label: "Experiencias reales", v: clamp(breakdown.real) },
    { k: "A", label: "Aprobaciones", v: clamp(breakdown.approved) },
    { k: "V", label: "Vigencia", v: clamp(breakdown.valid) },
  ]), [breakdown]);

  return (
    <div className="flex items-center gap-8">
      <div className="relative w-64 h-64 flex items-center justify-center">
        <svg height="224" width="224" className="rotate-[-90deg]">
          <circle stroke="#e5e7eb" fill="transparent" strokeWidth={stroke} r={normalized} cx="112" cy="112" />
          <circle
            strokeLinecap="round"
            className={`${ringClass} transition-all duration-700`}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            r={normalized}
            cx="112"
            cy="112"
          />
        </svg>

        <div className="absolute text-center">
          <div className="text-4xl font-semibold text-gray-900">{s}%</div>
          <div className="text-sm text-gray-500 mt-1">Confianza</div>
          <div className={`inline-flex mt-3 px-3 py-1 rounded-full border text-xs font-medium ${badge}`}>
            {level}
          </div>
        </div>
      </div>

      <div className="space-y-4 w-full">
        <div className="text-sm text-gray-600">
          Tu credibilidad se calcula a partir de verificaciones reales emitidas por empresas y evidencias consistentes.
        </div>

        <div className="grid gap-3">
          {items.map((it) => (
            <div key={it.k} className="group">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-gray-100 text-gray-700 font-semibold">
                    {it.k}
                  </span>
                  <span className="font-medium text-gray-700">{it.label}</span>
                </div>
                <span className="tabular-nums">{it.v}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${it.v}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-gray-500">
          Consejo: completar tu identidad (foto + titular) mejora tu ratio de respuesta y prepara tu CV verificado.
        </div>
      </div>
    </div>
  );
}
