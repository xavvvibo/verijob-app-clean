import type { ReactNode } from "react";

import CandidateSection from "../primitives/CandidateSection";

export default function OverviewProgressSection({ children }: { children: ReactNode }) {
  return (
    <CandidateSection
      title="Progreso del perfil"
      description="Qué parte de tu perfil ya transmite confianza y cuál es el siguiente paso más útil para reforzarlo."
      className="h-full"
    >
      {children}
    </CandidateSection>
  );
}
