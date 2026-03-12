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
  const bullets = signupBullets.length
    ? signupBullets
    : [
        "Perfil compartible",
        "Control del candidato",
        "Evidencias verificables",
        "Acceso en segundos",
      ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_0%_0%,#eff3ff_0%,#f7f9fe_46%,#fbfcff_100%)] text-slate-900">
      <div className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/92 backdrop-blur">
        <div className="mx-auto flex max-w-[1260px] items-center justify-between px-6 py-4">
          <a href="https://verijob.es" className="flex items-center gap-3">
            <img
              src="/brand/verijob-logo.svg"
              alt="Verijob"
              className="h-auto w-[168px] object-contain sm:w-[184px]"
              loading="eager"
            />
          </a>
          <div className="flex items-center gap-2">
            <a
              href="https://verijob.es"
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Ver la web
            </a>
            <a
              href="https://app.verijob.es"
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Ir a la app
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1260px] grid-cols-1 gap-10 px-6 py-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
        <div className="hidden lg:block">
          <div className="rounded-3xl border border-slate-200 bg-white/80 p-9 shadow-[0_22px_56px_rgba(15,23,42,.10)] backdrop-blur-sm">
            <div className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold tracking-wide text-indigo-700">
              Acceso seguro · Entorno verificado
            </div>
            <div className="mt-6 text-[2rem] font-black leading-tight tracking-tight text-slate-900">
              {title ?? "La confianza profesional empieza aquí."}
            </div>
            <div className="mt-3 max-w-xl text-base leading-relaxed text-slate-600">
              {subtitle ?? "Accede a una forma más fiable de presentar experiencia profesional para candidatos y empresas."}
            </div>

            <div className="mt-7 flex flex-wrap gap-2.5">
              {(leftPanelMode === "bullets" ? bullets : [
                "Perfil verificable",
                "Evidencias documentales",
                "Acceso en minutos",
                "Uso para candidato y empresa",
              ]).map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-8 max-w-lg text-sm leading-relaxed text-slate-500">
              Verijob centraliza acceso, verificación y trazabilidad en una experiencia de producto clara, limpia y profesional.
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[560px]">
          {children}
          <div className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-500">
            ¿Problemas para acceder? Revisa tu correo/OTP o vuelve a intentarlo en unos minutos.
          </div>
        </div>
      </div>
    </div>
  );
}
