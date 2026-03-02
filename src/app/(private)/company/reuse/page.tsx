import { Suspense } from "react";
import ReuseClient from "./ReuseClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function CompanyReusePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-600">Cargando…</div>}>
      <ReuseClient />
    </Suspense>
  );
}
