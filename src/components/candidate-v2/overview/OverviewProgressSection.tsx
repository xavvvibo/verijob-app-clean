import type { ReactNode } from "react";

import CandidateSection from "../primitives/CandidateSection";
import CandidateSurface from "../primitives/CandidateSurface";

export default function OverviewProgressSection({ children }: { children: ReactNode }) {
  return (
    <CandidateSection
      title="Fuerza del perfil"
      description="Base, experiencia, verificaciones, evidencias y visibilidad en una sola lectura."
      className="h-full"
    >
      <CandidateSurface tone="default" className="p-6 xl:p-7">
        {children}
      </CandidateSurface>
    </CandidateSection>
  );
}
