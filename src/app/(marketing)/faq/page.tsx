export default function FAQ() {
  return (
    <main className="max-w-[1200px] mx-auto px-6 py-16 text-slate-900">
      <h1 className="text-4xl font-semibold tracking-tight">FAQ</h1>
      <section className="mt-8 space-y-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">¿Qué es un perfil verificable?</h2>
          <p className="mt-2 text-sm text-slate-600">
            Es un perfil profesional con experiencias verificadas, evidencias profesionales y trust score.
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">¿Las empresas ven todo el perfil?</h2>
          <p className="mt-2 text-sm text-slate-600">
            Las empresas registradas acceden al perfil completo según permisos y contexto de uso.
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">¿Cómo accedo a mi cuenta?</h2>
          <p className="mt-2 text-sm text-slate-600">
            El acceso se realiza por código OTP enviado al email registrado.
          </p>
        </article>
      </section>
    </main>
  );
}
