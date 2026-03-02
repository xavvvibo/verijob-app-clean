export default function Home() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      <section className="max-w-6xl mx-auto px-6 py-24">
        <h1 className="text-4xl font-semibold mb-6">
          Infraestructura de verificación profesional
        </h1>
        <p className="text-lg text-gray-600 mb-10">
          El estándar verificable para contratación.
        </p>

        <div className="flex gap-6">
          <a
            href="https://app.verijob.es/signup?role=candidate"
            className="px-6 py-3 bg-black text-white rounded-md"
          >
            Soy candidato
          </a>

          <a
            href="https://app.verijob.es/signup?role=company"
            className="px-6 py-3 border border-black rounded-md"
          >
            Soy empresa
          </a>
        </div>
      </section>

      <section className="bg-gray-100 py-20">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl font-semibold mb-4">Para candidatos</h2>
            <p className="text-gray-700">
              No envíes solo un CV. Envía confianza verificable con trazabilidad real.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-semibold mb-4">Para empresas</h2>
            <p className="text-gray-700">
              Reduce riesgo, acelera decisiones y consulta credenciales verificadas.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t mt-24 py-10 text-sm text-gray-600">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-4 gap-8">
          <div>
            <p className="font-medium mb-2">Producto</p>
            <p>Verificaciones laborales</p>
            <p>Verificaciones académicas</p>
          </div>
          <div>
            <p className="font-medium mb-2">Recursos</p>
            <a href="/como-funciona">Cómo funciona</a>
          </div>
          <div>
            <p className="font-medium mb-2">Legal</p>
            <a href="/terminos">Términos</a><br />
            <a href="/privacidad">Privacidad</a><br />
            <a href="/cookies">Cookies</a>
          </div>
          <div>
            <p className="font-medium mb-2">Contacto</p>
            <p>contacto@verijob.es</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
