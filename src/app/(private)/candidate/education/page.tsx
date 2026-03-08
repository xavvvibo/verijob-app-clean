import Link from "next/link";

export const dynamic = "force-dynamic";

export default function CandidateEducationPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Educación</h1>
      <p className="text-sm text-gray-600">
        Gestiona tu formación académica desde tu perfil profesional.
      </p>
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <p className="text-sm text-gray-700">
          Añade o ajusta tus estudios para reforzar tu credibilidad profesional.
        </p>
        <div className="mt-4">
          <Link
            href="/candidate/profile"
            className="inline-flex rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Gestionar educación
          </Link>
        </div>
      </div>
    </div>
  );
}
