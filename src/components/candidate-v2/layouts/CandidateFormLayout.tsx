import type { ReactNode } from "react";

export default function CandidateFormLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[1500px] space-y-14 bg-white px-10 py-14 2xl:px-12">{children}</div>;
}
