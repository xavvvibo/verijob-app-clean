export default function ComoFunciona() {
  return (
    <main className="max-w-[1200px] mx-auto px-6 py-16 text-slate-900">
      <h1 className="text-4xl font-semibold tracking-tight">Cómo funciona VERIJOB</h1>
      <p className="mt-4 max-w-3xl text-slate-600 leading-relaxed">
        VERIJOB transforma un CV en un perfil profesional verificable con señales de confianza
        claras para empresas y candidatos.
      </p>

      <section className="mt-10 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paso 1</p>
          <h2 className="mt-2 text-lg font-semibold">Sube tu CV</h2>
          <p className="mt-2 text-sm text-slate-600">Carga tu CV y activa el procesamiento inicial del perfil.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paso 2</p>
          <h2 className="mt-2 text-lg font-semibold">Verificación automática de experiencias</h2>
          <p className="mt-2 text-sm text-slate-600">El historial se organiza y valida de forma automática con trazabilidad.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paso 3</p>
          <h2 className="mt-2 text-lg font-semibold">Perfil profesional verificable</h2>
          <p className="mt-2 text-sm text-slate-600">Obtén un perfil con trust score, experiencias verificadas y evidencias profesionales.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paso 4</p>
          <h2 className="mt-2 text-lg font-semibold">Compartir con empresas</h2>
          <p className="mt-2 text-sm text-slate-600">Comparte tu perfil verificable para que las empresas puedan evaluarlo en segundos.</p>
        </div>
      </section>
    </main>
  );
}
