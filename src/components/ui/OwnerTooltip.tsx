"use client";

import { useState } from "react";

export default function OwnerTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="Más información"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-semibold text-slate-500"
      >
        ?
      </button>
      {open ? (
        <span className="absolute left-1/2 top-6 z-50 w-60 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-2 text-[11px] text-slate-700 shadow-lg">
          {text}
        </span>
      ) : null}
    </span>
  );
}
