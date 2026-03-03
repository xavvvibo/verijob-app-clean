import React from "react";
import { ui } from "../tokens";

type NavItem = { label: string; active?: boolean };
type Props = {
  brand?: string;
  leftTitle: string;
  leftTabs: { label: string; active?: boolean }[];
  nav: NavItem[];
  children: React.ReactNode;
};

export function AppShell({ brand = "Verijob", leftTitle, leftTabs, nav, children }: Props) {
  return (
    <div className={`min-h-screen ${ui.bg} ${ui.text}`}>
      <div className="mx-auto max-w-[1220px] px-5 py-8">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[28px] font-extrabold tracking-tight">{leftTitle}</div>
            <div className="mt-3 flex items-center gap-6">
              {leftTabs.map((t) => (
                <div key={t.label} className="flex items-center gap-6">
                  <span className={t.active ? "font-bold text-slate-900" : "font-semibold text-slate-500"}>
                    {t.label}
                  </span>
                  <span className="h-5 w-px bg-slate-200" />
                </div>
              ))}
            </div>
          </div>
          <div className="text-sm text-slate-400">Prototype UI Route</div>
        </div>

        <div className={`mt-6 grid grid-cols-[260px_1fr] gap-6`}>
          <aside className={`${ui.card} ${ui.radius} ${ui.shadow} border ${ui.border} overflow-hidden`}>
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600" />
                <div className="text-lg font-extrabold">{brand}</div>
              </div>
            </div>
            <div className="px-3 pb-4">
              {nav.map((n) => (
                <button
                  key={n.label}
                  className={`w-full text-left px-4 py-3 rounded-xl font-semibold transition
                    ${n.active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  {n.label}
                </button>
              ))}
            </div>
          </aside>

          <main className="space-y-5">{children}</main>
        </div>
      </div>
    </div>
  );
}
