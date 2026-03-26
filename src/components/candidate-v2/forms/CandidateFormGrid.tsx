import type { ReactNode } from "react";

export default function CandidateFormGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`grid gap-6 xl:grid-cols-[1.05fr_0.95fr] ${className}`.trim()}>{children}</div>;
}
