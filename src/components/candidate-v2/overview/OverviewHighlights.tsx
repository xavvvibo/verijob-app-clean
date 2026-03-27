import type { ReactNode } from "react";

import CandidateSection from "../primitives/CandidateSection";

export default function OverviewHighlights({ children }: { children: ReactNode }) {
  return (
    <CandidateSection title="Qué hacer ahora" description="Tres mejoras rápidas para reforzar tu perfil sin perder tiempo.">
      {children}
    </CandidateSection>
  );
}
