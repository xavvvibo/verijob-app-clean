type PlanCard = {
  name: string;
  price: string;
  summary: string;
  bullets: string[];
  featured?: boolean;
};

const PLANS: PlanCard[] = [
  {
    name: "Access",
    price: "49 €/mes",
    summary: "Para equipos que empiezan a revisar candidatos con trazabilidad.",
    bullets: ["Revisión operativa básica", "Acceso a candidatos por token", "Gestión de solicitudes"],
  },
  {
    name: "Hiring",
    price: "99 €/mes",
    summary: "Equilibrio entre velocidad de evaluación y volumen de procesos.",
    bullets: ["Mayor capacidad de revisión", "Más accesos simultáneos a perfiles", "Soporte para equipo en crecimiento"],
    featured: true,
  },
  {
    name: "Team",
    price: "199 €/mes",
    summary: "Escalado para operaciones de contratación con alto ritmo.",
    bullets: ["Capacidad superior", "Más usuarios y coordinación", "Mayor control operativo"],
  },
];

export default async function UpgradePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const reason = typeof params?.reason === "string" ? params.reason : "";

  const helperText =
    reason === "inactive"
      ? "Tu plan actual no cubre esta funcionalidad. Revisa opciones para desbloquearla."
      : reason === "billing_error"
        ? "No se pudo validar el estado de tu suscripción. Puedes continuar desde aquí."
        : "Activa un plan de empresa para ampliar capacidad y velocidad de evaluación.";

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Upgrade empresa</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">Escala tu operación de verificación</h1>
        <p className="mt-2 text-sm text-slate-600">{helperText}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href="/company/billing" className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black transition">
            Volver a suscripción
          </a>
          <a href="mailto:contacto@verijob.es?subject=Upgrade%20Empresa%20VERIJOB" className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition">
            Contactar para activar plan
          </a>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <article
            key={plan.name}
            className={`rounded-3xl border p-6 shadow-sm ${plan.featured ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"}`}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{plan.name}</h2>
              {plan.featured ? (
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white">Más popular</span>
              ) : null}
            </div>
            <p className={`mt-2 text-3xl font-semibold ${plan.featured ? "text-white" : "text-slate-900"}`}>{plan.price}</p>
            <p className={`mt-2 text-sm ${plan.featured ? "text-white/80" : "text-slate-600"}`}>{plan.summary}</p>
            <ul className={`mt-4 space-y-2 text-sm ${plan.featured ? "text-white/90" : "text-slate-600"}`}>
              {plan.bullets.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Contratación</h2>
        <p className="mt-2 text-sm text-slate-600">
          Si Stripe está configurado en esta base, puedes abrir checkout directamente desde aquí. Si no, el sistema te indicará el bloqueo real.
        </p>
        <div className="mt-5">
          <CompanyPlanActions currentPlanLabel="" currentPlanCode="" hasActiveSubscription={false} />
        </div>
      </section>
    </main>
  );
}
import CompanyPlanActions from "../subscription/CompanyPlanActions";
