import type { ReactNode } from "react";

import CandidateSection from "../primitives/CandidateSection";

export default function OverviewExperiencesPreview({ action, children }: { action?: ReactNode; children: ReactNode }) {
  return (
    <CandidateSection title="Tus experiencias clave" description="El corazón del perfil VERIJOB: qué experiencias ya aportan señal y cuáles aún necesitan refuerzo." action={action}>
      {children}
    </CandidateSection>
  );
}
