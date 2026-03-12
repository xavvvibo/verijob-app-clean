import React from "react";

type Props = {
  title?: string;
  subtitle?: string;
  leftPanelMode?: "flow" | "bullets";
  signupBullets?: string[];
  children: React.ReactNode;
};

export default function PublicAuthShell({
  leftPanelMode = "flow",
  signupBullets = [],
  children,
}: Props) {
  const defaultBullets = [
    "Trust Score y señales verificables en un único perfil.",
    "Experiencias y evidencias trazables con control del titular.",
    "Acceso empresarial rápido para evaluación de credenciales.",
  ];
  const bullets = leftPanelMode === "bullets" && signupBullets.length
    ? signupBullets
    : defaultBullets;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <aside className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 px-8 py-12 lg:px-14 lg:py-16">
          <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
            <img
              src="/verijob-logo.png"
              alt="Verijob"
              className="h-10 w-auto object-contain"
              loading="eager"
            />

            <div className="mt-14 lg:mt-20">
              <h1 className="text-4xl font-bold tracking-tight text-white">
                Tu historial laboral verificado
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/90">
                Centraliza y verifica tu experiencia profesional en un perfil sólido, compartible y preparado para empresas.
              </p>

              <ul className="mt-6 space-y-2 text-white/80">
                {bullets.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </aside>

        <section className="flex items-center justify-center px-6 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-md">
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}
