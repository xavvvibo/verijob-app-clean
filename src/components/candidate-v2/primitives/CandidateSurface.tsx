import type { HTMLAttributes, ReactNode } from "react";

type Tone = "default" | "subtle" | "brand" | "dark";

const toneClasses: Record<Tone, string> = {
  default: "bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/70",
  subtle: "bg-slate-50/80 ring-1 ring-slate-200/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]",
  brand: "bg-gradient-to-br from-slate-50 via-indigo-50/70 to-blue-50/70 ring-1 ring-indigo-100/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
  dark: "bg-slate-950 text-white shadow-[0_16px_40px_rgba(15,23,42,0.18)]",
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
