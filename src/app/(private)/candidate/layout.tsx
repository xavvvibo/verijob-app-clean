import CandidateNav from "./CandidateNav";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">Portal candidato</h1>
          <p className="mt-2 text-sm text-gray-600">
            Gestiona tu perfil, verificaciones y enlaces para compartir.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <aside className="md:col-span-3">
            <div className="rounded-xl border bg-white p-4">
              <div className="mb-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                Navegación
              </div>
              <CandidateNav />
            </div>

            <div className="mt-4 rounded-xl border bg-white p-4">
              <div className="text-sm font-medium">Acción rápida</div>
              <div className="mt-1 text-xs text-gray-600">
                Genera tu enlace público de perfil.
              </div>
              <a
                href="/candidate/profile-share"
                className="mt-3 inline-block rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
              >
                Ir a Compartir perfil
              </a>
            </div>
          </aside>

          <main className="md:col-span-9">
            <div className="rounded-xl border bg-white p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
