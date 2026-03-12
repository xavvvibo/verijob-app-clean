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
  void leftPanelMode;
  void signupBullets;

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <aside className="flex items-center px-10 py-12 lg:px-20 lg:py-16">
          <div className="w-full max-w-xl">
            <img
              src="/brand/logo.png"
              alt="Verijob"
              className="mb-10 h-20 w-auto object-contain lg:h-28"
              loading="eager"
            />

            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white lg:text-5xl">
              La verdad profesional, verificada.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/90">
              Centraliza experiencia, verificaciones y credenciales profesionales en un perfil verificable para empresas.
            </p>
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
