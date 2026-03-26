import type { ReactNode } from "react";

export default function ShareActions({ children }: { children: ReactNode }) {
  return <div className="grid gap-2">{children}</div>;
}
