export default function Privacidad() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-20 text-gray-900">
      <h1 className="text-3xl font-semibold mb-6">Política de Privacidad</h1>

      <p className="text-gray-700">
        Responsable del tratamiento: VERIJOB. Para consultas: contacto@verijob.es
      </p>

      <h2 className="text-xl font-semibold mt-10 mb-3">Datos tratados</h2>
      <ul className="list-disc pl-6 text-gray-700 space-y-2">
        <li>Datos de identificación y contacto (p. ej., email).</li>
        <li>Datos profesionales y académicos aportados en el flujo de verificación.</li>
        <li>Evidencias y metadatos técnicos asociados (p. ej., hash de archivo, marcas temporales, rutas de almacenamiento).</li>
        <li>Registros de seguridad y auditoría para prevención de abuso.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-10 mb-3">Finalidades</h2>
      <ul className="list-disc pl-6 text-gray-700 space-y-2">
        <li>Prestar el servicio de verificación y compartición de credenciales.</li>
        <li>Seguridad, prevención de fraude y mantenimiento del sistema.</li>
        <li>Analítica (GA4) únicamente si el usuario consiente cookies analíticas.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-10 mb-3">Conservación</h2>
      <ul className="list-disc pl-6 text-gray-700 space-y-2">
        <li>Evidencias: borrado automático tras 12 meses sin actividad.</li>
        <li>Logs y metadatos: conservación hasta 24 meses.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-10 mb-3">Derechos</h2>
      <p className="text-gray-700">
        Puedes ejercer tus derechos de acceso, rectificación, supresión y demás derechos aplicables mediante contacto@verijob.es.
      </p>

      <p className="text-gray-500 mt-10 text-sm">Contacto: contacto@verijob.es</p>
    </main>
  );
}
