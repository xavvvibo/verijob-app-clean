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
    <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-100 via-indigo-100/70 to-blue-100/60 px-8 py-[4.5rem] sm:py-[5rem] xl:px-10 xl:py-[5.25rem]">
      {children}
      <div className="relative grid items-center gap-14 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="min-w-0">{left}</div>
        <div className="min-w-0">{right}</div>
      </div>
    </section>
  );
}
