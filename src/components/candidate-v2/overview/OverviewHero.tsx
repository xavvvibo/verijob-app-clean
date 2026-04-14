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
    <section className="relative overflow-hidden rounded-[42px] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.92),rgba(238,242,255,0.88)_28%,rgba(219,234,254,0.9)_65%,rgba(224,231,255,0.92)_100%)] px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12 xl:px-12 xl:py-14 2xl:px-14 2xl:py-[4.2rem] shadow-[0_32px_100px_rgba(15,23,42,0.14)] ring-1 ring-indigo-100/90">
      {children}
      <div className="relative grid items-start gap-7 xl:grid-cols-[minmax(0,1.56fr)_minmax(300px,0.62fr)] xl:gap-8 2xl:grid-cols-[minmax(0,1.62fr)_minmax(320px,0.58fr)] 2xl:gap-9">
        <div className="min-w-0 self-stretch">{left}</div>
        <div className="min-w-0 xl:self-start">{right}</div>
      </div>
    </section>
  );
}
