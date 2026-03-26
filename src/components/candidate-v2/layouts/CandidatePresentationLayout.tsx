import type { ReactNode } from "react";

export default function CandidatePresentationLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[1500px] space-y-12 bg-white px-8 py-12">{children}</div>;
}
