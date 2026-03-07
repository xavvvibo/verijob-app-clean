import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Logística",
  description: "Verificaciones profesionales para contratación en logística.",
  alternates: { canonical: "/logistica" },
};

export default function Logistica() {
  return (
    <main className="max-w-[1200px] mx-auto px-6 py-16 text-slate-900">
      <section>
        <h1 className="text-4xl font-semibold tracking-tight">Verijob en logística</h1>
        <p className="mt-4 max-w-3xl text-slate-600 leading-relaxed">
          Asegura fiabilidad del personal, reduce riesgo operativo y estandariza la confianza con credenciales verificadas.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="https://app.verijob.es/signup?role=company"
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Crear cuenta empresa
          </Link>
          <Link
            href="/como-funciona"
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-900"
          >
            Ver cómo funciona
          </Link>
        </div>
      </section>
    </main>
  );
}
