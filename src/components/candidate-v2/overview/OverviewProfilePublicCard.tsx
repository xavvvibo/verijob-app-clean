import type { ReactNode } from "react";

import CandidateSurface from "../primitives/CandidateSurface";

export default function OverviewProfilePublicCard({ children }: { children: ReactNode }) {
  return <CandidateSurface tone="subtle" className="p-6">{children}</CandidateSurface>;
}
