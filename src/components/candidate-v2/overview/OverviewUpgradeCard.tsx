import type { ReactNode } from "react";

import CandidateSurface from "../primitives/CandidateSurface";

export default function OverviewUpgradeCard({ children }: { children: ReactNode }) {
  return <CandidateSurface tone="brand" className="p-6">{children}</CandidateSurface>;
}
