import type { ReactNode } from "react";

import CandidateSplitHero from "../primitives/CandidateSplitHero";

export default function ShareHero({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return <CandidateSplitHero left={left} right={right} className="py-12 xl:px-10" />;
}
