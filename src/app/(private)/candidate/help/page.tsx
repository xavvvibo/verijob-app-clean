export const dynamic = "force-dynamic";

import CandidatePageHero from "../_components/CandidatePageHero";

export default function CandidateHelpPage() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-16 px-8 py-12">
      <CandidatePageHero
        eyebrow="Ayuda"
        title="Guía rápida para sacar más partido a tu perfil"
        description="Encuentra en segundos cómo construir un perfil verificable, reforzar tu credibilidad y compartir una trayectoria profesional clara."
        badges={["Perfil verificable", "Verificaciones", "Perfil público"]}
        showTrustScore={false}
      />

      <section className="rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <h2 className="text-lg font-semibold text-slate-900">Cómo funciona Verijob para candidatos</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
          <li>Subes tu CV y obtienes una estructura inicial de tu trayectoria.</li>
          <li>Revisas experiencias y formación en tus secciones correspondientes.</li>
          <li>Solicitas verificaciones a empresa o subes evidencias documentales.</li>
          <li>Tu credibilidad mejora a medida que se validan tus datos.</li>
        </ul>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <article className="rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h3 className="text-base font-semibold text-slate-900">Cómo subir tu CV</h3>
          <p className="mt-2 text-sm text-slate-700">
            Ve a Perfil o Experiencias, sube tu archivo y revisa las propuestas antes de importarlas.
          </p>
        </article>
        <article className="rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h3 className="text-base font-semibold text-slate-900">Cómo se verifican tus experiencias</h3>
          <p className="mt-2 text-sm text-slate-700">
            Puedes solicitar verificación a empresa o realizar verificación documental desde cada experiencia.
          </p>
        </article>
        <article className="rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h3 className="text-base font-semibold text-slate-900">Experiencia importada vs. verificada</h3>
          <p className="mt-2 text-sm text-slate-700">
            Importada significa estructurada pero sin validar. Verificada significa confirmada por evidencia o por empresa.
          </p>
        </article>
        <article className="rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h3 className="text-base font-semibold text-slate-900">Cómo compartir tu perfil</h3>
          <p className="mt-2 text-sm text-slate-700">
            Usa la sección Perfil público para previsualizar lo que verá cada tipo de empresa y gestionar tu enlace verificable.
          </p>
        </article>
        <article className="rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h3 className="text-base font-semibold text-slate-900">Cómo funciona tu suscripción</h3>
          <p className="mt-2 text-sm text-slate-700">
            Desde Suscripción puedes revisar tu plan, mejorarlo y acceder a la gestión de facturación.
          </p>
        </article>
        <article className="rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h3 className="text-base font-semibold text-slate-900">Soporte</h3>
          <p className="mt-2 text-sm text-slate-700">
            Si tienes incidencias, escríbenos a soporte y facilita el contexto de la verificación afectada.
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-blue-100 bg-blue-50 p-6">
        <h2 className="text-lg font-semibold text-blue-900">Viaje del candidato</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-blue-900">
          <li>Completa tu perfil</li>
          <li>Añade o revisa tu experiencia</li>
          <li>Solicita verificaciones o sube documentos</li>
          <li>Mejora tu credibilidad</li>
          <li>Comparte tu perfil verificable</li>
        </ol>
      </section>
    </div>
  );
}
