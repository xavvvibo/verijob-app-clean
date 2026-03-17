export const dynamic = "force-dynamic";

const FAQS = [
  {
    q: "¿Cómo reviso solicitudes de verificación?",
    a: "Desde Solicitudes puedes filtrar por estado, abrir el detalle de cada verificación y tomar decisiones con trazabilidad.",
  },
  {
    q: "¿Cómo desbloqueo un candidato completo?",
    a: "Desde Candidatos abre el resumen parcial y, si te interesa, accede al perfil completo consumiendo 1 acceso.",
  },
  {
    q: "¿Cómo accedo a un candidato completo?",
    a: "En Candidatos pega el token compartido por el profesional para abrir su perfil verificable ampliado en contexto empresa.",
  },
  {
    q: "¿Cómo funciona la suscripción de empresa?",
    a: "En Suscripción puedes consultar plan activo, límites operativos y opciones de mejora para ampliar capacidad de revisión y equipo.",
  },
];

export default function CompanyHelpPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Centro de ayuda para empresa</h1>
        <p className="mt-2 text-sm text-slate-600">
          Resuelve dudas operativas sobre revisión de candidatos, acceso a perfiles completos y gestión de plan.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Primeros pasos del equipo</h2>
          <ol className="mt-3 space-y-2 text-sm text-slate-600">
            <li>1. Configura tu panel en <a href="/company/settings" className="underline underline-offset-2">Ajustes</a>.</li>
            <li>2. Revisa la cola de verificación en <a href="/company/requests" className="underline underline-offset-2">Solicitudes</a>.</li>
            <li>3. Consulta candidatos por token en <a href="/company/candidates" className="underline underline-offset-2">Candidatos</a>.</li>
            <li>4. Gestiona accesos y desbloqueos desde <a href="/company/candidates" className="underline underline-offset-2">Candidatos</a>.</li>
            <li>5. Revisa límites, saldo y plan en <a href="/company/billing" className="underline underline-offset-2">Suscripción</a>.</li>
          </ol>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-base font-semibold text-slate-900">Soporte</h2>
          <p className="mt-2 text-sm text-slate-600">
            Si detectas incidencias o necesitas ayuda en un proceso de revisión, escribe a soporte con el ID de verificación y contexto del caso.
          </p>
          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
            <p className="font-semibold text-slate-900">Canal recomendado</p>
            <p className="mt-1 text-slate-600">contacto@verijob.es</p>
          </div>
        </article>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Preguntas frecuentes</h2>
        <div className="mt-3 space-y-3">
          {FAQS.map((item) => (
            <article key={item.q} className="rounded-2xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900">{item.q}</h3>
              <p className="mt-1 text-sm text-slate-600">{item.a}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
