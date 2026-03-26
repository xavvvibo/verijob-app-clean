import type { ReactNode } from "react";

import CandidateToolbar from "../primitives/CandidateToolbar";

export default function CandidateFiltersBar({ children }: { children: ReactNode }) {
  return <CandidateToolbar>{children}</CandidateToolbar>;
}
