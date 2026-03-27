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
    <section className="relative overflow-hidden rounded-[40px] bg-gradient-to-br from-slate-100 via-indigo-100/85 to-blue-100/75 px-6 py-10 sm:px-8 sm:py-12 lg:px-10 lg:py-14 xl:px-12 xl:py-16 2xl:px-14 2xl:py-[4.8rem] shadow-[0_28px_90px_rgba(15,23,42,0.11)] ring-1 ring-indigo-100/70">
      {children}
      <div className="relative grid items-start gap-8 xl:grid-cols-[minmax(0,1.42fr)_minmax(280px,0.72fr)] xl:gap-8 2xl:grid-cols-[minmax(0,1.48fr)_minmax(320px,0.68fr)] 2xl:gap-10">
        <div className="min-w-0 self-stretch">{left}</div>
        <div className="min-w-0 xl:self-start">{right}</div>
      </div>
    </section>
  );
}
