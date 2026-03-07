export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </div>
  );
}

export default async function PublicCandidatePage({ params }: Ctx) {
  const { token } = await params;
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://app.verijob.es";
  const apiRes = await fetch(`${origin}/api/public/candidate/${token}`, { cache: "no-store" });
  const apiBody = await apiRes.json().catch(() => ({}));

  const teaser = apiBody?.teaser || {
    full_name: "Candidato verificado",
    description:
      "Este candidato dispone de perfil laboral verificable en Verijob. Regístrate o inicia sesión como empresa para consultar la vista ampliada.",
    trust_score: 0,
    experiences_total: 0,
    education_total: 0,
    achievements_total: 0,
    profile_visibility: "private",
  };

  const nextPath = `/company/candidate/${token}`;
  const loginUrl = `${origin}/login?mode=company&next=${encodeURIComponent(nextPath)}`;
  const signupUrl = `${origin}/signup?mode=company&next=${encodeURIComponent(nextPath)}`;
  const displayName = teaser?.full_name || "Candidato verificado";

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <section className="overflow-hidden rounded-[28px] border bg-white shadow-sm">
          <div className="border-b bg-slate-950 px-8 py-8 text-white">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
              Verijob
            </div>
            <h1 className="mt-3 text-3xl font-semibold">Bienvenido a Verijob</h1>
            <p className="mt-2 text-base text-slate-200">La verdad laboral verificada</p>
            <p className="mt-4 max-w-3xl text-sm text-slate-300">
              {teaser.description ||
                "Este candidato dispone de perfil laboral verificable en Verijob. Regístrate o inicia sesión como empresa para consultar la vista ampliada."}
            </p>
          </div>

          <div className="grid gap-8 px-8 py-8 lg:grid-cols-[1.3fr_0.7fr]">
            <div>
              <div className="rounded-2xl border bg-slate-50 p-5">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Candidato
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">{displayName}</div>
                <div className="mt-2 text-sm text-slate-600">
                  Vista teaser pública orientada a empresa. El detalle ampliado requiere registro o inicio de sesión.
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <StatCard label="Experiencias registradas" value={teaser.experiences_total} />
                <StatCard label="Datos académicos" value={teaser.education_total} />
                <StatCard label="Otros logros" value={teaser.achievements_total} />
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <StatCard label="Trust Score" value={Number(teaser.trust_score ?? 0)} />
                <StatCard label="Experiencias verificadas" value={Number(teaser.verified_experiences ?? 0)} />
              </div>

              <div className="mt-6 rounded-2xl border p-5">
                <div className="text-sm font-semibold text-slate-900">Qué podrás ver como empresa</div>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  <li>• Historial laboral estructurado del candidato</li>
                  <li>• Señales de credibilidad y trazabilidad documental</li>
                  <li>• Vista ampliada para análisis interno y selección</li>
                </ul>
              </div>
            </div>

            <aside className="rounded-2xl border bg-slate-50 p-5">
              <div className="text-sm font-semibold text-slate-900">Acceso empresa</div>
              <p className="mt-2 text-sm text-slate-600">
                Crea una cuenta o entra como empresa para consultar la vista ampliada de este perfil en Verijob.
              </p>

              <div className="mt-5 flex flex-col gap-3">
                <a
                  className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white"
                  href={signupUrl}
                >
                  Registrarme como empresa
                </a>
                <a
                  className="inline-flex items-center justify-center rounded-xl border bg-white px-4 py-3 text-sm font-medium text-slate-900"
                  href={loginUrl}
                >
                  Ya tengo cuenta
                </a>
              </div>

              <div className="mt-6 rounded-xl border bg-white p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Estado público</div>
                <div className="mt-2 text-sm text-slate-700">
                  Modo de visibilidad: <span className="font-medium">{teaser.profile_visibility}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Fuente score: {apiBody?.route_version || "public-candidate-token-v1"}
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
