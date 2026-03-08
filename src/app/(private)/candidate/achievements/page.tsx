import Link from "next/link";

export const dynamic = "force-dynamic";

export default function CandidateAchievementsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Logros</h1>
      <p className="text-sm text-gray-600">
        Gestiona certificaciones y otros hitos profesionales de tu perfil.
      </p>
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <p className="text-sm text-gray-700">
          Completa esta sección para reforzar la lectura global de tu trayectoria.
        </p>
        <div className="mt-4">
          <Link
            href="/candidate/profile"
            className="inline-flex rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Gestionar logros
          </Link>
        </div>
      </div>
    </div>
  );
}
