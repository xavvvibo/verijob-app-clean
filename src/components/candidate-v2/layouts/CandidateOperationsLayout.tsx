import type { ReactNode } from "react";

export default function CandidateOperationsLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[1520px] space-y-12 bg-white px-10 py-14 2xl:px-12">{children}</div>;
}
