"use client";

import { useEffect, useState } from "react";

type Kpis = {
  pending_requests: number;
  verified_30d: number;
  reuse_rate_pct: number;
  risk_signals: number;
  reuse_events_30d: number;
  reuse_events_total: number;
};

function Card({ title, value, subtitle }: { title: string; value: any; subtitle: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-3xl shadow-sm p-6">
      <div className="text-xs font-semibold text-gray-500 tracking-wide">{title}</div>
      <div className="mt-3 text-3xl font-semibold text-gray-900 tabular-nums">{value}</div>
      <div className="mt-3 text-sm text-gray-600">{subtitle}</div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  leftBtn,
  rightBtn,
}: {
  title: string;
  subtitle: string;
  leftBtn: { label: string; href: string };
  rightBtn?: { label: string; href: string };
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-3xl shadow-sm p-6">
      <div className="text-sm font-semibold text-gray-900">{title}</div>
      <div className="mt-2 text-sm text-gray-600">{subtitle}</div>
      <div className="mt-5 flex flex-wrap gap-3">
        <a
          href={leftBtn.href}
          className="inline-flex px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-black transition"
        >
          {leftBtn.label}
        </a>
        {rightBtn ? (
          <a
            href={rightBtn.href}
            className="inline-flex px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 text-sm font-semibold hover:bg-gray-50 transition"
          >
            {rightBtn.label}
          </a>
        ) : null}
      </div>
    </div>
  );
}

export default function CompanyDashboard() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/company/dashboard", { cache: "no-store" as any });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "dashboard_kpis_failed");
        if (!alive) return;
        setKpis(j?.kpis || null);
        setErr(null);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "dashboard_kpis_failed");
      }
    })();
    return () => { alive = false; };
  }, []);

  const pending = kpis ? kpis.pending_requests : "—";
  const verified30d = kpis ? kpis.verified_30d : "—";
  const reuseRate = kpis ? `${kpis.reuse_rate_pct}%` : "—";
  const risk = kpis ? kpis.risk_signals : "—";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="text-3xl font-semibold text-gray-900">Trust & Risk Command Center</div>
          <div className="mt-2 text-sm text-gray-600">
            Verificación operativa para contratación: estado, cola, reutilización y trazabilidad.
          </div>
          {err ? <div className="mt-3 text-sm text-red-600">{err}</div> : null}
        </div>

        <div className="flex flex-wrap gap-3 shrink-0">
          <a href="/company/requests" className="inline-flex px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-black transition">
            Ver solicitudes
          </a>
          <a href="/company/reuse" className="inline-flex px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 text-sm font-semibold hover:bg-gray-50 transition">
            Reutilizar
          </a>
          <a href="/company/candidates" className="inline-flex px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 text-sm font-semibold hover:bg-gray-50 transition">
            Abrir candidato
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card title="PENDIENTES" value={pending} subtitle="Solicitudes activas" />
        <Card title="VERIFICADAS (30D)" value={verified30d} subtitle="Producción reciente" />
        <Card title="REUSE RATE" value={reuseRate} subtitle="Ahorro de tiempo" />
        <Card title="RIESGO" value={risk} subtitle="Señales / incidencias" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard
          title="Cola operativa"
          subtitle="Vista rápida de lo que requiere acción hoy."
          leftBtn={{ label: "Gestionar cola", href: "/company/requests" }}
          rightBtn={{ label: "Equipo & permisos", href: "/company/team" }}
        />
        <SectionCard
          title="Reutilización"
          subtitle="Importa verificaciones previas con consentimiento y reduce fricción."
          leftBtn={{ label: "Reutilizar ahora", href: "/company/reuse" }}
        />
        <SectionCard
          title="Plan & facturación"
          subtitle="Créditos, límites de usuarios y upgrades. (Stripe LIVE en cierre final)"
          leftBtn={{ label: "Ver facturación", href: "/company/billing" }}
          rightBtn={{ label: "Ajustes", href: "/company/settings" }}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-3xl shadow-sm p-6">
        <div className="text-sm font-semibold text-gray-900">Siguiente (B)</div>
        <ul className="mt-3 text-sm text-gray-700 list-disc pl-5 space-y-2">
          <li>Conectar KPIs reales (requests/verifications/evidences/reuse) con endpoint company.</li>
          <li>Tabla “Cola” con filtros: estado, fecha, candidato, puesto.</li>
          <li>Panel “Riesgo”: incidencias relevantes + tiempos de respuesta.</li>
        </ul>
      </div>
    </div>
  );
}
