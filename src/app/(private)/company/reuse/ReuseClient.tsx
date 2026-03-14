"use client";

import Link from "next/link";

export default function ReuseClient() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Accesos a perfiles</h1>
        <p className="mt-2 text-sm text-slate-600">
          Esta ruta se mantiene por compatibilidad, pero el modelo actual de negocio se basa en desbloquear perfiles completos para tu empresa durante una ventana temporal.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Qué puedes hacer desde aquí</h2>
          <p className="mt-2 text-sm text-slate-600">
            Usa la base RRHH para revisar candidatos con acceso activo, detectar accesos expirados y volver a desbloquear perfiles cuando necesites abrir de nuevo el CV completo.
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
          <h2 className="text-sm font-semibold text-slate-900">Cómo usar esta pantalla</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>1. Abre la base RRHH para ver candidatos con acceso activo o expirado.</li>
            <li>2. Revisa el snapshot sin coste antes de desbloquear el perfil completo.</li>
            <li>3. Si el acceso ya expiró, compra o consume un nuevo acceso y vuelve a abrir el CV.</li>
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            Las solicitudes siguen disponibles en <Link href="/company/requests" className="underline underline-offset-2">Solicitudes</Link>, pero el acceso completo a perfiles se gestiona desde Candidatos.
          </p>
        </aside>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Modelo actual de acceso</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          <li>El acceso completo al CV se activa para tu empresa cuando consumes una visualización o crédito.</li>
          <li>Ese acceso dura una ventana temporal limitada y luego pasa a expirar.</li>
          <li>El candidato sigue existiendo en tu base RRHH aunque el acceso completo ya no esté activo.</li>
          <li>Si otra empresa quiere verlo, debe pagar o consumir su propio acceso de forma independiente.</li>
        </ul>
      </section>
    </div>
  );
}
