import type { ReactNode } from "react";

export default function CandidatePresentationLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1720px] space-y-14 bg-white px-6 py-12 sm:px-8 xl:px-10 2xl:px-12">{children}</div>;
}
