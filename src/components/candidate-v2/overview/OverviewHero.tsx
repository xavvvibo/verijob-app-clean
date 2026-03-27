import type { ReactNode } from "react";

export default function OverviewHero({
  left,
  right,
  children,
}: {
  left: ReactNode;
  right: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-[40px] bg-gradient-to-br from-slate-100 via-indigo-100/85 to-blue-100/75 px-10 py-[5.4rem] sm:px-12 sm:py-[6.1rem] xl:px-14 xl:py-[6.4rem] shadow-[0_28px_90px_rgba(15,23,42,0.11)] ring-1 ring-indigo-100/70">
      {children}
      <div className="relative grid items-center gap-12 xl:grid-cols-[1.08fr_0.92fr] xl:gap-18">
        <div className="min-w-0">{left}</div>
        <div className="min-w-0">{right}</div>
      </div>
    </section>
  );
}
