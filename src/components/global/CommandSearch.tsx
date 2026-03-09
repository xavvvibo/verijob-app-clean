"use client";

import { useState } from "react";

export default function CommandSearch() {
  const [value, setValue] = useState("");

  return (
    <div className="hidden lg:block">
      <label className="sr-only" htmlFor="owner-command-search">
        Buscar
      </label>
      <input
        id="owner-command-search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buscar usuario, empresa o verificación..."
        className="w-[360px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
      />
    </div>
  );
}
