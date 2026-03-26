import type { ReactNode } from "react";

import CandidateSurface from "../primitives/CandidateSurface";

export default function OverviewProfilePublicCard({ children }: { children: ReactNode }) {
  return <CandidateSurface tone="subtle" className="p-7 xl:p-8">{children}</CandidateSurface>;
}
