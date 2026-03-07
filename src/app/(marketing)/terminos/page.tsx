export default function Terminos() {
  return (
    <main className="max-w-[1200px] mx-auto px-6 py-16 text-gray-900">
      <h1 className="text-3xl font-semibold mb-6">Términos y Condiciones</h1>

      <p className="text-gray-700">
        VERIJOB es una infraestructura de verificación profesional que permite emitir, gestionar y compartir
        credenciales laborales y académicas con trazabilidad e integridad técnica.
      </p>

      <h2 className="text-xl font-semibold mt-10 mb-3">Roles y responsabilidad</h2>
      <ul className="list-disc pl-6 text-gray-700 space-y-2">
        <li>La empresa emisora es responsable de la veracidad del contenido que declara.</li>
        <li>El candidato es titular de la credencial y puede compartirla mediante enlaces.</li>
        <li>VERIJOB certifica la integridad técnica (trazabilidad, evidencias y registros), no la veracidad material del contenido.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-10 mb-3">Revocación</h2>
      <p className="text-gray-700">
        Las verificaciones pueden ser revocadas por la empresa emisora o por el candidato. La revocación queda registrada con motivo y marca temporal.
      </p>

      <h2 className="text-xl font-semibold mt-10 mb-3">Uso aceptable</h2>
      <p className="text-gray-700">
        Queda prohibido el uso fraudulento, la manipulación de evidencias, el intento de acceso no autorizado o la automatización abusiva del servicio.
      </p>

      <h2 className="text-xl font-semibold mt-10 mb-3">Planes y facturación</h2>
      <p className="text-gray-700">
        Los planes de pago y condiciones de facturación se muestran antes de completar la contratación.
        El acceso empresarial se orienta al desbloqueo de perfiles verificables completos, no a verificaciones unitarias.
      </p>

      <h2 className="text-xl font-semibold mt-10 mb-3">Propiedad intelectual</h2>
      <p className="text-gray-700">
        La marca VERIJOB, su software y sus contenidos son titularidad de sus propietarios y están protegidos
        conforme a la normativa vigente.
      </p>

      <h2 className="text-xl font-semibold mt-10 mb-3">Jurisdicción</h2>
      <p className="text-gray-700">Estos términos se rigen por la legislación española.</p>

      <p className="text-gray-500 mt-10 text-sm">Contacto: contacto@verijob.es</p>
    </main>
  );
}
