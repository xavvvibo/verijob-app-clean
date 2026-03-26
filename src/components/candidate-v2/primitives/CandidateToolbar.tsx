import type { ReactNode } from "react";

export default function CandidateToolbar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-3 rounded-2xl bg-slate-50/85 px-5 py-4 ring-1 ring-slate-200/70 sm:flex-row sm:items-center sm:justify-between ${className}`.trim()}>
      {children}
    </div>
  );
}
