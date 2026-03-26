import type { ReactNode } from "react";

export default function CandidateListItemShell({ children }: { children: ReactNode }) {
  return <article className="border-b border-slate-100 py-6 transition-colors duration-150 hover:bg-slate-50/40">{children}</article>;
}
