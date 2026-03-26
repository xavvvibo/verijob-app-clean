import type { ReactNode } from "react";

import CandidateSection from "../primitives/CandidateSection";

export default function OverviewHighlights({ children }: { children: ReactNode }) {
  return (
    <CandidateSection title="Qué hacer ahora" description="Las dos acciones con más impacto para reforzar tu perfil hoy.">
      {children}
    </CandidateSection>
  );
}
