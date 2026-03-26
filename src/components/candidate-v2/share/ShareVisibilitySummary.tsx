import type { ReactNode } from "react";

import CandidateSurface from "../primitives/CandidateSurface";

export default function ShareVisibilitySummary({ children }: { children: ReactNode }) {
  return <CandidateSurface tone="subtle" className="p-5">{children}</CandidateSurface>;
}
