import type { ReactNode } from "react";

import CandidateStickyActionBar from "../primitives/CandidateStickyActionBar";

export default function CandidateSaveBar({ children }: { children: ReactNode }) {
  return (
    <CandidateStickyActionBar>
      <div className="mx-auto flex w-full max-w-[1420px] items-center justify-between gap-3 px-8 py-3">{children}</div>
    </CandidateStickyActionBar>
  );
}
