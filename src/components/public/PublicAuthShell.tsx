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
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-50 border-b border-slate-200 bg-slate-50/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4">
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
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:opacity-90"
            >
              Ver la web
            </a>
            <a
              href="https://app.verijob.es"
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Ir a la app
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-10 px-6 py-10 lg:grid-cols-2">
        <div className="hidden lg:block">
          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_16px_44px_rgba(2,6,23,.10)]">
            <div className="text-xs font-semibold text-slate-500">
              Acceso seguro · Control del titular · Trazabilidad
            </div>
            <div className="mt-3 text-3xl font-black tracking-tight text-slate-950">
              {title ?? "Accede a tu perfil verificable"}
            </div>
            {subtitle ? (
              <div className="mt-3 text-base leading-relaxed text-slate-600">
                {subtitle}
              </div>
            ) : (
              <div className="mt-3 text-base leading-relaxed text-slate-600">
                Menos fricción en selección: experiencia estructurada, evidencias opcionales y visibilidad bajo tu control.
              </div>
            )}

            {leftPanelMode === "flow" ? (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Flujo verificable
                </div>
                <div className="mt-3 space-y-2">
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900">
                    CV
                  </div>
                  <div className="text-center text-slate-400">↓</div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900">
                    Extracción automática
                  </div>
                  <div className="text-center text-slate-400">↓</div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900">
                    Verificación
                  </div>
                  <div className="text-center text-slate-400">↓</div>
                  <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-slate-900">
                    Perfil verificable (Trust Score + Evidencias)
                  </div>
                  <div className="text-center text-slate-400">↓</div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900">
                    Empresa evalúa el perfil
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Qué obtienes con tu cuenta
                </div>
                <ul className="mt-3 space-y-2 text-sm font-semibold text-slate-900">
                  {bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                    >
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs text-slate-500">Valor</div>
                <div className="mt-2 font-extrabold text-slate-900">
                  Perfil compartible
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs text-slate-500">Valor</div>
                <div className="mt-2 font-extrabold text-slate-900">
                  Control del candidato
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs text-slate-500">Valor</div>
                <div className="mt-2 font-extrabold text-slate-900">
                  Evidencias verificables
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs text-slate-500">Valor</div>
                <div className="mt-2 font-extrabold text-slate-900">
                  Acceso en segundos
                </div>
              </div>
            </div>

            <div className="mt-6 text-xs text-slate-500">
              Comunicamos valor y control, sin exponer detalles técnicos copiables.
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_44px_rgba(2,6,23,.10)]">
          {children}
          <div className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-500">
            ¿Problemas para acceder? Revisa tu correo/OTP o vuelve a intentarlo en unos minutos.
          </div>
        </div>
      </div>
    </div>
  );
}
