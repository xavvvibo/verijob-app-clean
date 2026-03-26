import type { ReactNode } from "react";

import CandidateSurface from "../primitives/CandidateSurface";

export default function ShareQRCodePanel({ children }: { children: ReactNode }) {
  return <CandidateSurface className="p-5">{children}</CandidateSurface>;
}
