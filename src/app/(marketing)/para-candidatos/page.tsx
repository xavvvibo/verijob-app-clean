export default function ParaCandidatos() {
  return (
    <main className="max-w-[1200px] mx-auto px-6 py-16 text-slate-900">
      <h1 className="text-4xl font-semibold tracking-tight">Para candidatos</h1>
      <p className="mt-4 max-w-3xl text-slate-600 leading-relaxed">
        Construye un perfil profesional verificable para demostrar tu trayectoria con más claridad.
      </p>
      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Experiencias verificadas</h2>
          <p className="mt-2 text-sm text-slate-600">Muestra experiencia real con señales de confianza comprobables.</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Perfil compartible</h2>
          <p className="mt-2 text-sm text-slate-600">Comparte tu perfil verificable con empresas de forma rápida y profesional.</p>
        </article>
      </section>
    </main>
  );
}
