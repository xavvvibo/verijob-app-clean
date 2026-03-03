"use client";

import { useMemo } from "react";

function TrustRing({ score }: { score: number }) {
  const radius = 90;
  const stroke = 14;
  const normalized = radius - stroke * 0.5;
  const circumference = normalized * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 85
      ? "stroke-green-600"
      : score >= 70
      ? "stroke-green-500"
      : score >= 40
      ? "stroke-blue-600"
      : "stroke-gray-400";

  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
      <svg height="220" width="220" className="rotate-[-90deg]">
        <circle
          stroke="#e5e7eb"
          fill="transparent"
          strokeWidth={stroke}
          r={normalized}
          cx="110"
          cy="110"
        />
        <circle
          strokeLinecap="round"
          className={`${color} transition-all duration-700`}
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          r={normalized}
          cx="110"
          cy="110"
        />
      </svg>

      <div className="absolute text-center">
        <div className="text-4xl font-semibold text-gray-900">{score}%</div>
        <div className="text-sm text-gray-500 mt-1">
          Nivel de confianza
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export default function CandidateOverview() {
  // MOCK (conectar luego a Supabase)
  const data = {
    name: "Carlos Martínez",
    title: "Camarero Senior",
    location: "Granada, España",
    score: 82,
    breakdown: { real: 40, approved: 30, valid: 30 },
    stats: {
      active: 3,
      pending: 1,
      shared: 5,
      views: 18,
      avgValidation: "2.8 días",
    },
    experiences: [
      {
        company: "Restaurante Central",
        role: "Camarero",
        status: "Verificado",
      },
      {
        company: "Hotel Sol",
        role: "Ayudante de sala",
        status: "En revisión",
      },
    ],
  };

  const level = useMemo(() => {
    if (data.score >= 85) return "Profesional validado";
    if (data.score >= 70) return "Alta confianza";
    if (data.score >= 40) return "Verificado";
    return "Inicial";
  }, [data.score]);

  return (
    <div className="min-h-screen bg-gray-50 px-8 py-10">
      <div className="max-w-7xl mx-auto space-y-12">

        {/* HERO */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-10 flex flex-col lg:flex-row gap-12 items-center">

          <TrustRing score={data.score} />

          <div className="flex-1 space-y-6">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-2xl font-medium">
                CM
              </div>
              <div>
                <h1 className="text-3xl font-semibold text-gray-900">
                  {data.name}
                </h1>
                <p className="text-gray-500">{data.title}</p>
                <p className="text-gray-400 text-sm">{data.location}</p>
              </div>
            </div>

            <div className="inline-flex px-4 py-2 rounded-full bg-green-50 text-green-700 text-sm font-medium">
              {level}
            </div>

            <div className="grid md:grid-cols-3 gap-4 pt-4">
              <ProgressBar label="R · Experiencias reales" value={40} />
              <ProgressBar label="A · Aprobaciones" value={30} />
              <ProgressBar label="V · Vigencia" value={30} />
            </div>

            <div className="flex gap-4 pt-6">
              <button className="px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition">
                Añadir verificación
              </button>
              <button className="px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition">
                Compartir perfil
              </button>
              <button className="px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition">
                Editar perfil
              </button>
            </div>
          </div>
        </div>

        {/* HOW TO IMPROVE */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
          <div className="text-blue-800 font-medium">
            Cómo mejorar tu perfil
          </div>
          <ul className="mt-3 text-sm text-blue-700 space-y-1">
            <li>✔ Añade tu experiencia más reciente</li>
            <li>✔ Completa tu fotografía profesional</li>
            <li>✔ Comparte tu perfil con 2 empresas</li>
          </ul>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          <Stat label="Verificaciones activas" value={data.stats.active} />
          <Stat label="Pendientes" value={data.stats.pending} />
          <Stat label="Perfil compartido" value={data.stats.shared} />
          <Stat label="Visualizaciones" value={data.stats.views} />
          <Stat label="Tiempo medio validación" value={data.stats.avgValidation} />
        </div>

        {/* EXPERIENCES */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Experiencia profesional verificada
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {data.experiences.map((exp, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm"
              >
                <div className="text-lg font-medium text-gray-900">
                  {exp.company}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {exp.role}
                </div>

                <div className="mt-4 text-sm font-medium">
                  <span
                    className={
                      exp.status === "Verificado"
                        ? "text-green-600"
                        : "text-amber-600"
                    }
                  >
                    {exp.status}
                  </span>
                </div>

                <button className="mt-4 text-blue-600 text-sm hover:underline">
                  Ver detalle
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-semibold text-gray-900 mt-2">
        {value}
      </div>
    </div>
  );
}
