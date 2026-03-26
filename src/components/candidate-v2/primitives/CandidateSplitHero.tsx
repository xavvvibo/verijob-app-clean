import type { ReactNode } from "react";

export default function CandidateSplitHero({
  left,
  right,
  className = "",
}: {
  left: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`relative overflow-hidden rounded-[34px] bg-gradient-to-br from-slate-50 via-indigo-50/75 to-blue-50/75 px-10 py-12 shadow-[0_18px_50px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/60 ${className}`.trim()}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(99,102,241,0.16),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(14,165,233,0.1),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-white/5 to-white/0" />
      <div className="relative grid gap-10 xl:grid-cols-[1.22fr_0.78fr] xl:items-center">
        <div className="min-w-0">{left}</div>
        {right ? <div className="min-w-0">{right}</div> : null}
      </div>
    </section>
  );
}
