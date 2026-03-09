import LoginCard from "@/components/auth/LoginCard";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-100">
      <div className="grid min-h-screen lg:grid-cols-5">
        <section className="relative overflow-hidden bg-gradient-to-br from-[#4568DC] to-[#B06AB3] px-8 py-12 text-white lg:col-span-3 lg:px-14 lg:py-16">
          <div className="flex h-full flex-col justify-between">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logo.png" alt="Verijob" className="h-10 w-auto" />
            </div>

            <div className="max-w-2xl">
              <h1 className="text-4xl font-semibold leading-tight lg:text-5xl">Tu historial laboral verificado</h1>
              <p className="mt-4 text-base text-white/90 lg:text-lg">
                Centraliza y verifica tu experiencia profesional.
              </p>

              <div className="mt-10 inline-flex items-center gap-3 rounded-xl border border-white/25 bg-white/10 px-4 py-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20">✓</span>
                <span className="text-sm font-medium text-white/95">Verificación profesional segura</span>
              </div>
            </div>

            <p className="text-xs text-white/70">Plataforma profesional VERIJOB</p>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-12 lg:col-span-2 lg:px-10">
          <LoginCard />
        </section>
      </div>
    </main>
  );
}
