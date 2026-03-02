import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function CandidateVerificationsPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold">Verificaciones</h2>
      <p className="mt-2 text-sm text-gray-600">
        Aquí consolidaremos tu historial de verificaciones y enlaces compartibles.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link className="rounded-md border p-4 hover:bg-gray-50" href="/candidate/verification">
          <div className="text-sm font-medium">Ir al flujo de verificación</div>
          <div className="mt-1 text-xs text-gray-600">Subida / evidencias / estado.</div>
        </Link>

        <Link className="rounded-md border p-4 hover:bg-gray-50" href="/candidate/overview">
          <div className="text-sm font-medium">Volver a Resumen</div>
          <div className="mt-1 text-xs text-gray-600">Accesos rápidos.</div>
        </Link>
      </div>

      <p className="mt-6 text-xs text-gray-600">
        Nota: el listado automático lo montamos cuando confirmes qué tabla/listado quieres priorizar (verification_requests vs view resumen).
      </p>
    </div>
  );
}
