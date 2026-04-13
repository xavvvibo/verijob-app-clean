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
    <section className="relative overflow-hidden rounded-[40px] bg-gradient-to-br from-slate-100 via-indigo-100/95 to-blue-100/80 px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12 xl:px-12 xl:py-14 2xl:px-14 2xl:py-[4.2rem] shadow-[0_28px_90px_rgba(15,23,42,0.12)] ring-1 ring-indigo-100/80">
      {children}
      <div className="relative grid items-start gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.7fr)] xl:gap-7 2xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.66fr)] 2xl:gap-8">
        <div className="min-w-0 self-stretch">{left}</div>
        <div className="min-w-0 xl:self-start">{right}</div>
      </div>
    </section>
  );
}
