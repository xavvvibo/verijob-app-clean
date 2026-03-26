import type { ReactNode } from "react";

import CandidateSurface from "../primitives/CandidateSurface";

export default function CandidateFormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <CandidateSurface className="p-6">
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">{title}</h2>
          {description ? <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p> : null}
        </div>
        {children}
      </div>
    </CandidateSurface>
  );
}
