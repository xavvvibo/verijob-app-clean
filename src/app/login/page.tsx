import LoginCard from "@/components/auth/LoginCard";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#4568DC] via-[#6a79d8] to-[#B06AB3]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.22),transparent_35%),radial-gradient(circle_at_80%_15%,rgba(255,255,255,0.18),transparent_30%),radial-gradient(circle_at_70%_80%,rgba(15,23,42,0.22),transparent_35%)]" />
      <div className="relative mx-auto grid min-h-screen w-full max-w-[1280px] items-center gap-8 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
        <section className="hidden px-2 py-6 text-white md:block">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/branding/verijob-logo-horizontal.png"
              alt="Verijob"
              className="h-auto w-[252px] object-contain [filter:drop-shadow(0_8px_20px_rgba(15,23,42,0.35))]"
            />
          </div>

          <h1 className="mt-10 max-w-2xl text-4xl font-semibold leading-tight lg:text-5xl">
            Tu historial laboral verificado
          </h1>
          <p className="mt-4 max-w-2xl text-base text-white/90 lg:text-lg">
            Centraliza y verifica tu experiencia profesional en un perfil sólido, compartible y preparado para empresas.
          </p>

          <ul className="mt-8 max-w-2xl space-y-3 text-sm font-medium text-white/90 lg:text-base">
            <li>• Trust Score y señales verificables en un único perfil.</li>
            <li>• Experiencias y evidencias trazables con control del titular.</li>
            <li>• Acceso empresarial rápido para evaluación de credenciales.</li>
          </ul>
        </section>

        <section className="flex items-center justify-center">
          <div className="w-full max-w-[460px] rounded-3xl border border-white/40 bg-white/88 p-2 shadow-[0_28px_80px_rgba(15,23,42,0.28)] backdrop-blur">
            <LoginCard />
          </div>
        </section>
      </div>
    </main>
  );
}
