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
    <section className="relative overflow-hidden rounded-[36px] bg-gradient-to-br from-slate-100 via-indigo-100/80 to-blue-100/70 px-10 py-[5.1rem] sm:py-[5.6rem] xl:px-12 xl:py-[5.9rem] shadow-[0_24px_70px_rgba(15,23,42,0.1)] ring-1 ring-indigo-100/70">
      {children}
      <div className="relative grid items-center gap-16 xl:grid-cols-[1.12fr_0.88fr]">
        <div className="min-w-0">{left}</div>
        <div className="min-w-0">{right}</div>
      </div>
    </section>
  );
}
