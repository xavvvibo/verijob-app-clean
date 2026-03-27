import type { ReactNode } from "react";

import CandidateSection from "../primitives/CandidateSection";

export default function OverviewProgressSection({ children }: { children: ReactNode }) {
  return (
    <CandidateSection
      title="Palancas de mejora"
      description="Estado de preparación del perfil y margen real para hacerlo más fuerte frente a una empresa."
      className="h-full"
    >
      {children}
    </CandidateSection>
  );
}
