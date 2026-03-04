import React from "react";

type Props = {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
};

export default function PublicAuthShell({ title, subtitle, children }: Props) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-50 border-b border-slate-200 bg-slate-50/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <a href="https://verijob.es" className="flex items-center gap-3">
            <img
              src="/brand/logo.png"
              alt="Verijob"
              className="h-6 w-auto"
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

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-5 py-10 lg:grid-cols-2">
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

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs text-slate-500">Compartir</div>
                <div className="mt-2 font-extrabold text-slate-900">Enlace verificable</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs text-slate-500">Control</div>
                <div className="mt-2 font-extrabold text-slate-900">Revocable</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs text-slate-500">Consistencia</div>
                <div className="mt-2 font-extrabold text-slate-900">Evidencias</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs text-slate-500">Reutilización</div>
                <div className="mt-2 font-extrabold text-slate-900">1 clic</div>
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
