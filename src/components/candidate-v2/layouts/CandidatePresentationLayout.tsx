import type { ReactNode } from "react";

export default function CandidatePresentationLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[1600px] space-y-14 bg-white px-10 py-14 2xl:px-12">{children}</div>;
}
