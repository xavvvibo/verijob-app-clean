import type { ReactNode } from "react";

export default function CandidateOperationsLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[1420px] space-y-10 bg-white px-8 py-12">{children}</div>;
}
