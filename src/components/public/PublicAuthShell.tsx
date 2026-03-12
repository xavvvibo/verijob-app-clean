import React from "react";

type Props = {
  title?: string;
  subtitle?: string;
  leftPanelMode?: "flow" | "bullets";
  signupBullets?: string[];
  children: React.ReactNode;
};

export default function PublicAuthShell({
  title,
  subtitle,
  leftPanelMode = "flow",
  signupBullets = [],
  children,
}: Props) {
  const heroTitle = title || "Tu historial laboral verificado.";
  const heroSubtitle =
    subtitle ||
    "Verijob permite demostrar tu experiencia profesional con verificaciones reales de empresas y documentos.";

  const defaultBullets = [
    "Verifica tu experiencia laboral",
    "Comparte tu perfil verificado",
    "Genera confianza en cada candidatura",
  ];

  const bullets =
    leftPanelMode === "bullets" && signupBullets.length > 0
      ? signupBullets
      : defaultBullets;

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-700 to-violet-700">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(255,255,255,0.18),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.12),transparent_45%),radial-gradient(circle_at_75%_85%,rgba(255,255,255,0.08),transparent_40%)]" />

      <div className="relative grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <aside className="flex items-center px-8 py-10 sm:px-10 lg:px-20 lg:py-16">
          <div className="w-full max-w-xl">
            <img
              src="/brand/verijob-logo-no-tagline.png"
              alt="Verijob"
              className="mb-10 h-16 w-auto object-contain lg:h-20"
              loading="eager"
            />

            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white lg:text-5xl">{heroTitle}</h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/90">
              {heroSubtitle}
            </p>

            <ul className="mt-8 space-y-2 text-sm font-medium text-white/85 sm:text-base">
              {bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-white/85" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <section className="flex items-center justify-center px-6 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-[460px]">
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}
