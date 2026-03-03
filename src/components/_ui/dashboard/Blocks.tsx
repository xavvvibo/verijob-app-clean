import React from "react";
import { ui } from "../tokens";

export function Card({ title, right, children }: { title?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={`${ui.card} ${ui.radiusClass} ${ui.shadow} border ${ui.border}`}>
      {(title || right) && (
        <header className="px-6 pt-5 pb-3 flex items-start justify-between gap-4">
          <div className="text-base font-extrabold text-slate-900">{title}</div>
          {right}
        </header>
      )}
      <div className={title || right ? "px-6 pb-6" : "p-6"}>{children}</div>
    </section>
  );
}

export function StatPill({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral"|"good"|"warn"|"bad" }) {
  const toneCls =
    tone === "good" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : tone === "warn" ? "bg-amber-50 text-amber-800 border-amber-200"
    : tone === "bad" ? "bg-rose-50 text-rose-700 border-rose-200"
    : "bg-slate-50 text-slate-700 border-slate-200";
  return (
    <div className={`px-4 py-3 rounded-2xl border ${toneCls} flex items-center justify-between gap-4`}>
      <div className="text-xs font-bold uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-xl font-extrabold">{value}</div>
    </div>
  );
}

export function SoftButton({ label, kind="primary" }: { label: string; kind?: "primary"|"ghost"|"warn" }) {
  const cls =
    kind === "primary"
      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
      : kind === "warn"
      ? "bg-amber-50 text-amber-900 border border-amber-200"
      : "bg-white text-slate-800 border border-slate-200";
  return (
    <button className={`px-4 py-2.5 rounded-xl font-extrabold text-sm shadow-sm hover:opacity-95 transition ${cls}`}>
      {label}
    </button>
  );
}

export function ProgressBar({ pct }: { pct: number }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-3 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600" style={{ width: `${p}%` }} />
    </div>
  );
}

export function RingGauge({ pct, labelTop, labelBottom }: { pct: number; labelTop: string; labelBottom: string }) {
  const p = Math.max(0, Math.min(100, pct));
  const deg = Math.round((p/100)*360);
  return (
    <div className="relative h-[140px] w-[140px]">
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: `conic-gradient(#22c55e 0deg, #22c55e ${deg}deg, #e2e8f0 ${deg}deg, #e2e8f0 360deg)` }}
      />
      <div className="absolute inset-[10px] rounded-full bg-white border border-slate-200 flex flex-col items-center justify-center">
        <div className="text-xs font-bold text-slate-500">{labelTop}</div>
        <div className="text-4xl font-extrabold text-slate-900">{p}%</div>
        <div className="text-xs font-bold text-emerald-700">{labelBottom}</div>
      </div>
    </div>
  );
}
