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
    <section className={`relative overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-50 via-indigo-50/70 to-blue-50/70 px-8 py-10 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ${className}`.trim()}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(99,102,241,0.14),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(14,165,233,0.08),transparent_60%)]" />
      <div className="relative grid gap-8 xl:grid-cols-[1.3fr_0.7fr] xl:items-center">
        <div className="min-w-0">{left}</div>
        {right ? <div className="min-w-0">{right}</div> : null}
      </div>
    </section>
  );
}
