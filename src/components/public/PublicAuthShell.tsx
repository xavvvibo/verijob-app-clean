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
    <div className="min-h-screen bg-[radial-gradient(circle_at_0%_0%,#2e4fa1_0%,#18233f_42%,#0b1225_100%)] text-slate-100">
      <div className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/55 backdrop-blur">
        <div className="mx-auto flex max-w-[1260px] items-center justify-between px-6 py-4">
          <a href="https://verijob.es" className="flex items-center gap-3">
            <img
              src="/branding/verijob-logo-horizontal.png"
              alt="Verijob"
              className="h-auto w-40"
              loading="eager"
            />
          </a>
          <div className="flex items-center gap-2">
            <a
              href="https://verijob.es"
              className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              Ver la web
            </a>
            <a
              href="https://app.verijob.es"
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Ir a la app
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1260px] grid-cols-1 gap-8 px-6 py-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-stretch">
        <div className="hidden lg:block">
          <div className="h-full rounded-3xl border border-white/15 bg-[linear-gradient(155deg,rgba(255,255,255,.14)_0%,rgba(255,255,255,.03)_56%,rgba(14,21,45,.62)_100%)] p-8 shadow-[0_28px_70px_rgba(2,6,23,.42)]">
            <div className="inline-flex rounded-full border border-sky-200/30 bg-sky-100/15 px-3 py-1 text-xs font-semibold tracking-wide text-sky-100">
              Acceso seguro · Control del titular · Trazabilidad
            </div>
            <div className="mt-5 text-4xl font-black tracking-tight text-white">
              {title ?? "Accede a tu perfil verificable"}
            </div>
            {subtitle ? (
              <div className="mt-3 max-w-xl text-base leading-relaxed text-slate-200/95">
                {subtitle}
              </div>
            ) : (
              <div className="mt-3 max-w-xl text-base leading-relaxed text-slate-200/95">
                Menos fricción en selección: experiencia estructurada, evidencias opcionales y visibilidad bajo tu control.
              </div>
            )}

            {leftPanelMode === "flow" ? (
              <div className="mt-7 rounded-2xl border border-white/15 bg-slate-950/25 p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Flujo verificable
                </div>
                <div className="mt-3 space-y-2">
                  <div className="rounded-xl border border-white/15 bg-white/95 px-4 py-3 text-sm font-semibold text-slate-900">
                    CV
                  </div>
                  <div className="text-center text-slate-300">↓</div>
                  <div className="rounded-xl border border-white/15 bg-white/95 px-4 py-3 text-sm font-semibold text-slate-900">
                    Extracción automática
                  </div>
                  <div className="text-center text-slate-300">↓</div>
                  <div className="rounded-xl border border-white/15 bg-white/95 px-4 py-3 text-sm font-semibold text-slate-900">
                    Verificación
                  </div>
                  <div className="text-center text-slate-300">↓</div>
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-slate-900">
                    Perfil verificable (Trust Score + Evidencias)
                  </div>
                  <div className="text-center text-slate-300">↓</div>
                  <div className="rounded-xl border border-white/15 bg-white/95 px-4 py-3 text-sm font-semibold text-slate-900">
                    Empresa evalúa el perfil
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-7 rounded-2xl border border-white/15 bg-slate-950/25 p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Qué obtienes con tu cuenta
                </div>
                <ul className="mt-3 space-y-2 text-sm font-semibold text-slate-900">
                  {bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="rounded-xl border border-white/15 bg-white/95 px-4 py-3"
                    >
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/15 bg-white/95 p-4">
                <div className="text-xs text-slate-500">Valor</div>
                <div className="mt-2 font-extrabold text-slate-900">
                  Perfil compartible
                </div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/95 p-4">
                <div className="text-xs text-slate-500">Valor</div>
                <div className="mt-2 font-extrabold text-slate-900">
                  Control del candidato
                </div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/95 p-4">
                <div className="text-xs text-slate-500">Valor</div>
                <div className="mt-2 font-extrabold text-slate-900">
                  Evidencias verificables
                </div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/95 p-4">
                <div className="text-xs text-slate-500">Valor</div>
                <div className="mt-2 font-extrabold text-slate-900">
                  Acceso en segundos
                </div>
              </div>
            </div>

            <div className="mt-6 text-xs text-slate-200/85">
              Comunicamos valor y control, sin exponer detalles técnicos copiables.
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/12 bg-slate-950/35 p-4 shadow-[0_24px_60px_rgba(2,6,23,.35)] sm:p-6">
          {children}
          <div className="mt-6 border-t border-white/10 pt-4 text-xs text-slate-300">
            ¿Problemas para acceder? Revisa tu correo/OTP o vuelve a intentarlo en unos minutos.
          </div>
        </div>
      </div>
    </div>
  );
}
