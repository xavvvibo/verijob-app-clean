export default function Contacto() {
  return (
    <main className="max-w-[1200px] mx-auto px-6 py-16 text-slate-900">
      <h1 className="text-4xl font-semibold tracking-tight">Contacto</h1>
      <p className="mt-4 max-w-3xl text-slate-600 leading-relaxed">
        Si necesitas apoyo comercial, técnico o legal, nuestro equipo puede ayudarte.
      </p>
      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Contacto general</h2>
          <p className="mt-2 text-sm text-slate-600">contacto@verijob.es</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Privacidad y RGPD</h2>
          <p className="mt-2 text-sm text-slate-600">privacy@verijob.es</p>
        </article>
      </section>
    </main>
  );
}
