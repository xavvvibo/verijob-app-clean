import type { ReactNode } from "react";

export default function CandidateQuickStatsRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2.5">{children}</div>;
}
