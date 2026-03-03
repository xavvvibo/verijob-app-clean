import React from "react";
import { AppShell } from "@/components/_ui/dashboard/AppShell";
import { Card, RingGauge, SoftButton, StatPill, ProgressBar } from "@/components/_ui/dashboard/Blocks";

export default function UIPrototype() {
  return (
    <div>
      {/* Candidate */}
      <AppShell
        leftTitle="Candidate Dashboard"
        leftTabs={[{ label: "Trust Center", active: true }, { label: "Career Workspace" }]}
        nav={[
          { label: "Mi Perfil", active: true },
          { label: "Verificaciones" },
          { label: "Evidencias" },
          { label: "Compartidas" },
          { label: "Historial" },
        ]}
      >
        <Card>
          <div className="grid grid-cols-[1fr_160px] gap-6 items-center">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600" />
                <div className="text-lg font-extrabold">Tu credibilidad profesional</div>
              </div>
              <div className="mt-3 h-3 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
                <div className="h-full w-[78%] bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full" />
              </div>
              <div className="mt-3 text-sm text-slate-500 font-semibold">
                Perfil verificado, con trazabilidad documental y validación por empresas.
              </div>
            </div>
            <div className="flex justify-end">
              <RingGauge pct={87} labelTop="Perfil Verificado" labelBottom="Alto" />
            </div>
          </div>

          <div className="mt-6 border-t border-slate-200/80 pt-5">
            <div className="text-sm font-extrabold text-slate-900 mb-3">Historial verificado</div>
            <div className="space-y-3">
              {[
                { name: "Tech Solutions", status: "Verificado", tone: "good" as const },
                { name: "Beta Corp", status: "En revisión", tone: "warn" as const },
                { name: "Global Sales Inc.", status: "Aprobado", tone: "good" as const },
              ].map((r) => (
                <div key={r.name} className="flex items-center justify-between rounded-2xl border border-slate-200/80 px-4 py-3">
                  <div className="font-bold text-slate-900">{r.name}</div>
                  <div className={`text-xs font-extrabold px-3 py-1 rounded-full border
                    ${r.tone === "good" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-amber-50 text-amber-900 border-amber-200"}`}>
                    {r.status}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <SoftButton label="Subir Evidencia" kind="ghost" />
              <SoftButton label="Compartir Perfil" kind="primary" />
              <SoftButton label="Solicitar Validación" kind="ghost" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="grid grid-cols-3 gap-4">
            <StatPill label="Empresas verificadas" value="3" tone="neutral" />
            <StatPill label="Tiempo promedio" value="2.4 días" tone="good" />
            <StatPill label="Nivel de confianza" value="Alto" tone="good" />
          </div>
        </Card>

        {/* Company as second section below (en el adjunto está al lado; aquí lo ponemos debajo para no complicar layout) */}
        <div className="pt-2" />
        <div className="text-xl font-extrabold text-slate-900">Company Dashboard</div>

        <Card>
          <div className="grid grid-cols-[1fr_320px] gap-6 items-center">
            <div>
              <div className="text-lg font-extrabold text-slate-900">Risk Command Center</div>
              <div className="mt-2 text-sm text-slate-500 font-semibold">
                Plan Scale · Pool de créditos por empresa · Ventana reutilización 90 días
              </div>
              <div className="mt-4 grid grid-cols-4 gap-3">
                <StatPill label="Verificaciones activas" value="24" tone="neutral" />
                <StatPill label="Pendientes" value="8" tone="warn" />
                <StatPill label="Riesgo laboral" value="Bajo" tone="good" />
                <StatPill label="Tiempo ahorrado" value="152h" tone="good" />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200/80 p-4">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Créditos disponibles</div>
                  <div className="text-3xl font-extrabold text-slate-900">18 / 50</div>
                  <div className="text-sm font-semibold text-slate-500">Renueva en 14 días</div>
                </div>
                <SoftButton label="Ampliar plan" kind="primary" />
              </div>
              <div className="mt-3">
                <ProgressBar pct={64} />
              </div>
              <div className="mt-3 text-xs font-semibold text-slate-500">
                Dentro del producto real: aquí conectaremos a vuestro sistema de créditos/ventana 30/90.
              </div>
            </div>
          </div>
        </Card>

        <Card title="Cola de verificación" right={<SoftButton label="Ver todo" kind="ghost" />}>
          <div className="overflow-hidden rounded-2xl border border-slate-200/80">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <th className="px-4 py-3 font-extrabold text-slate-600">Candidato</th>
                  <th className="px-4 py-3 font-extrabold text-slate-600">Empresa</th>
                  <th className="px-4 py-3 font-extrabold text-slate-600">Estado</th>
                  <th className="px-4 py-3 font-extrabold text-slate-600">Acción</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { c: "Ana Gómez", e: "In Review", s: "Revisando", tone: "warn" as const },
                  { c: "Luis Pérez", e: "Aprobado", s: "Verificado", tone: "good" as const },
                  { c: "Sara Rivas", e: "Pendiente", s: "Pendiente", tone: "warn" as const },
                ].map((r) => (
                  <tr key={r.c} className="border-t border-slate-200/80">
                    <td className="px-4 py-3 font-bold text-slate-900">{r.c}</td>
                    <td className="px-4 py-3 text-slate-600 font-semibold">{r.e}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-extrabold px-3 py-1 rounded-full border
                        ${r.tone === "good" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-amber-50 text-amber-900 border-amber-200"}`}>
                        {r.s}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <SoftButton label="Aprobar" kind={r.tone === "good" ? "ghost" : "primary"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid grid-cols-[1fr_280px] gap-5">
            <div className="rounded-2xl border border-slate-200/80 p-5">
              <div className="text-sm font-extrabold text-slate-900">Company Risk Score</div>
              <div className="mt-2 text-4xl font-extrabold text-slate-900">92 <span className="text-slate-400 text-2xl">/ 100</span></div>
              <div className="mt-2 text-sm font-semibold text-slate-500">+3 pts esta semana</div>
              <div className="mt-4 space-y-2 text-sm font-semibold text-slate-600">
                <div>✓ Validaciones completas</div>
                <div>✓ Tiempo promedio</div>
                <div>✓ Reuse rate</div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 p-5">
              <div className="text-sm font-extrabold text-slate-900">Siguiente acción</div>
              <div className="mt-2 text-sm font-semibold text-slate-500">
                Completa tu perfil de empresa para aumentar tasa de respuesta.
              </div>
              <div className="mt-4">
                <SoftButton label="Subir documento" kind="primary" />
              </div>
            </div>
          </div>
        </Card>

        <div className="text-xs text-slate-400 pb-6">
          Ruta prototype: <span className="font-semibold text-slate-500">/app/_ui</span> (no toca tus rutas reales).
        </div>
      </AppShell>
    </div>
  );
}
