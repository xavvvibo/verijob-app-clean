import type { ReactNode } from "react";

import CandidateSurface from "../primitives/CandidateSurface";

export default function SharePublicCard({ children }: { children: ReactNode }) {
  return <CandidateSurface tone="subtle" className="p-6 xl:p-7">{children}</CandidateSurface>;
}
