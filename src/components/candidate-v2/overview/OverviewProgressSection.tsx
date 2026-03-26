import type { ReactNode } from "react";

import CandidateSection from "../primitives/CandidateSection";

export default function OverviewProgressSection({ children }: { children: ReactNode }) {
  return (
    <CandidateSection title="Progreso del perfil" description="Señales visibles de qué parte de tu perfil ya transmite confianza y qué parte aún necesita refuerzo.">
      {children}
    </CandidateSection>
  );
}
