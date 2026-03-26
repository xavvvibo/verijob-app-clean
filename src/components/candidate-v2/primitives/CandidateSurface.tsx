import type { HTMLAttributes, ReactNode } from "react";

type Tone = "default" | "subtle" | "brand" | "dark";

const toneClasses: Record<Tone, string> = {
  default: "bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/55",
  subtle: "bg-slate-50/85 ring-1 ring-slate-200/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_8px_24px_rgba(15,23,42,0.04)]",
  brand: "bg-gradient-to-br from-slate-50 via-indigo-50/80 to-blue-50/75 ring-1 ring-indigo-100/75 shadow-[0_12px_30px_rgba(99,102,241,0.08)]",
  dark: "bg-slate-950 text-white shadow-[0_24px_60px_rgba(15,23,42,0.2)]",
};

export default function CandidateSurface({
  children,
  className = "",
  tone = "default",
  ...rest
}: HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  className?: string;
  tone?: Tone;
}) {
  return (
    <section {...rest} className={`rounded-[28px] ${toneClasses[tone]} ${className}`.trim()}>
      {children}
    </section>
  );
}
