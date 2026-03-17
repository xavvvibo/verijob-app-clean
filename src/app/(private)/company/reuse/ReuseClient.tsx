"use client";

import Link from "next/link";

export default function ReuseClient() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Guía rápida de accesos</h1>
        <p className="mt-2 text-sm text-slate-600">
          Esta información ya se integra de forma operativa en Candidatos y Suscripción. Esta ruta queda como referencia rápida, pero ya no forma parte de la navegación principal.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Dónde gestionar cada tarea</h2>
          <p className="mt-2 text-sm text-slate-600">
            Usa estas dos superficies para el trabajo real diario con accesos y perfiles completos.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/company/candidates"
              className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
            >
              Abrir base RRHH
            </Link>
            <Link
              href="/company/subscription"
              className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Comprar accesos o mejorar plan
            </Link>
          </div>
        </article>

        <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-sm font-semibold text-slate-900">Qué verás en cada una</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>1. En Candidatos: previews, desbloqueos, accesos activos o expirados y decisión operativa por perfil.</li>
            <li>2. En Suscripción: saldo disponible, accesos incluidos por plan, compras puntuales y estado documental de empresa.</li>
            <li>3. Cuando un candidato aún no está listo, verás un estado de perfil en preparación y no se consumirá ningún acceso.</li>
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            Las solicitudes siguen disponibles en <Link href="/company/requests" className="underline underline-offset-2">Solicitudes</Link>. El desbloqueo real de perfiles se gestiona desde <Link href="/company/candidates" className="underline underline-offset-2">Candidatos</Link>.
          </p>
        </aside>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Modelo actual de acceso</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          <li>El acceso completo al perfil se activa para tu empresa cuando consumes 1 acceso.</li>
          <li>Ver el resumen parcial o abrir un candidato todavía incompleto no consume acceso.</li>
          <li>Ese acceso queda asociado a tu empresa y, cuando expira, el candidato sigue apareciendo en tu base RRHH con su resumen parcial.</li>
          <li>El candidato sigue existiendo en tu base RRHH aunque el acceso completo ya no esté activo.</li>
          <li>Si otra empresa quiere verlo, debe pagar o consumir su propio acceso de forma independiente.</li>
        </ul>
      </section>
    </div>
  );
}
