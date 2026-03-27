import type { ReactNode } from "react";

import CandidateSection from "../primitives/CandidateSection";

export default function OverviewExperiencesPreview({ action, children }: { action?: ReactNode; children: ReactNode }) {
  return (
    <CandidateSection title="Tus experiencias" description="La parte más importante de tu perfil: qué trayecto ya aporta señal y qué aún necesita refuerzo." action={action}>
      {children}
    </CandidateSection>
  );
}
