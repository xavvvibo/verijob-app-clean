export default function Precios() {
  return (
    <main className="max-w-[1200px] mx-auto px-6 py-16 text-slate-900">
      <h1 className="text-4xl font-semibold tracking-tight">Precios</h1>
      <p className="mt-4 max-w-3xl text-slate-600 leading-relaxed">
        Estructura de acceso simple: candidatos con planes progresivos y empresas con acceso
        al perfil verificable completo.
      </p>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Candidatos</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          {["Free", "Starter", "Pro", "Pro+"].map((plan) => (
            <article key={plan} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold">{plan}</h3>
              <p className="mt-2 text-sm text-slate-600">
                Perfil verificable y herramientas adaptadas al nivel del plan.
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Empresas</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-5">
          {[
            { name: "Free", price: "0€" },
            { name: "Access", price: "49€" },
            { name: "Hiring", price: "99€" },
            { name: "Team", price: "199€" },
            { name: "Enterprise", price: "Contacto" },
          ].map((plan) => (
            <article key={plan.name} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="mt-2 text-2xl font-bold text-slate-900">{plan.price}</p>
              <p className="mt-2 text-sm text-slate-600">
                Acceso al perfil completo verificable según capacidades del plan.
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Pago por uso</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Perfil individual</h3>
            <p className="mt-2 text-sm text-slate-600">
              Desbloqueo puntual del perfil verificable de un candidato.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Pack 5 perfiles</h3>
            <p className="mt-2 text-sm text-slate-600">
              Paquete para procesos con varias candidaturas simultáneas.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
