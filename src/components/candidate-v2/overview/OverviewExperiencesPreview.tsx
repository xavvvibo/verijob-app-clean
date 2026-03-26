import type { ReactNode } from "react";

import CandidateSection from "../primitives/CandidateSection";

export default function OverviewExperiencesPreview({ action, children }: { action?: ReactNode; children: ReactNode }) {
  return (
    <CandidateSection title="Experiencias que más pesan en tu perfil" description="Un resumen estratégico de las experiencias que ya te ayudan a generar credibilidad." action={action}>
      {children}
    </CandidateSection>
  );
}
