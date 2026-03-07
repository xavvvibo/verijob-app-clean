export default function ParaEmpresas() {
  return (
    <main className="max-w-[1200px] mx-auto px-6 py-16 text-slate-900">
      <h1 className="text-4xl font-semibold tracking-tight">Para empresas</h1>
      <p className="mt-4 max-w-3xl text-slate-600 leading-relaxed">
        Evalúa candidatos con perfiles verificables y señales agregadas de credibilidad antes de decidir.
      </p>
      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Evaluación con confianza</h2>
          <p className="mt-2 text-sm text-slate-600">Trust score, experiencias verificadas y evidencias profesionales en una sola vista.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Proceso más ágil</h2>
          <p className="mt-2 text-sm text-slate-600">Reduce tiempos de revisión con perfiles completos y estructurados.</p>
        </article>
      </section>
    </main>
  );
}
