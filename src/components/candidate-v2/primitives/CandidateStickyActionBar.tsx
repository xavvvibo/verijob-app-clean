import type { ReactNode } from "react";

export default function CandidateStickyActionBar({ children }: { children: ReactNode }) {
  return <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur">{children}</div>;
}
