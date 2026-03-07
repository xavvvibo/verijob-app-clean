export default function Seguridad() {
  return (
    <main className="max-w-[1200px] mx-auto px-6 py-16 text-slate-900">
      <h1 className="text-4xl font-semibold tracking-tight">Seguridad</h1>
      <p className="mt-4 max-w-3xl text-slate-600 leading-relaxed">
        VERIJOB aplica privacidad por diseño, permisos por rol y trazabilidad para proteger
        credenciales laborales verificables.
      </p>
      <section className="mt-10 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Control de acceso</h2>
          <p className="mt-2 text-sm text-slate-600">
            Separación por empresa y acceso mínimo necesario según contexto y rol.
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Trazabilidad verificable</h2>
          <p className="mt-2 text-sm text-slate-600">
            Registro de acciones clave para mantener consistencia y auditoría operativa.
          </p>
        </article>
      </section>
    </main>
  );
}
