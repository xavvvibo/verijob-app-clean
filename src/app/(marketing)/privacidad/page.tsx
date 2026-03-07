export default function Privacidad() {
  return (
    <main className="max-w-[1200px] mx-auto px-6 py-16 text-gray-900">
      <h1 className="text-3xl font-semibold mb-6">Política de privacidad</h1>

      <h2 className="text-xl font-semibold mt-10 mb-3">1. Responsable del tratamiento</h2>
      <p className="text-gray-700">
        El responsable del tratamiento de los datos personales tratados a través de VERIJOB es Javier Bocanegra.
        Los datos identificativos completos del responsable pueden consultarse en el Aviso legal.
        <br />
        Contacto de privacidad: contacto@verijob.es
      </p>

      <h2 className="text-xl font-semibold mt-10 mb-3">2. Qué datos tratamos</h2>
      <ul className="list-disc pl-6 text-gray-700 space-y-2">
        <li>
          Datos de cuenta e identificación: correo electrónico, identificadores de usuario, rol dentro de la
          plataforma y datos básicos de perfil.
        </li>
        <li>Datos de uso y seguridad: registros técnicos, eventos de acceso, actividad y trazabilidad.</li>
        <li>Datos profesionales: información aportada por el usuario sobre su experiencia, formación y perfil profesional.</li>
        <li>
          Evidencias profesionales: documentos, archivos y metadatos que el usuario suba voluntariamente para procesos
          de verificación.
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-10 mb-3">3. Finalidades del tratamiento</h2>
      <ul className="list-disc pl-6 text-gray-700 space-y-2">
        <li>Gestionar el alta, autenticación y acceso a la plataforma.</li>
        <li>Permitir la creación y gestión de perfiles profesionales verificables.</li>
        <li>Procesar evidencias y generar resultados o estados de verificación.</li>
        <li>Mantener la seguridad del servicio, prevenir fraude y realizar auditorías.</li>
        <li>Atender consultas, incidencias y solicitudes de soporte.</li>
        <li>Cumplir obligaciones legales aplicables.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-10 mb-3">4. Base jurídica</h2>
      <ul className="list-disc pl-6 text-gray-700 space-y-2">
        <li>La ejecución de la relación contractual o precontractual vinculada al uso del servicio.</li>
        <li>El interés legítimo en garantizar la seguridad, prevenir usos fraudulentos y mejorar el servicio.</li>
        <li>El cumplimiento de obligaciones legales.</li>
        <li>El consentimiento, cuando sea necesario para finalidades específicas.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-10 mb-3">5. Destinatarios y encargados</h2>
      <p className="text-gray-700">
        VERIJOB puede apoyarse en proveedores tecnológicos que actúan como encargados del tratamiento, por ejemplo para
        hosting, autenticación, almacenamiento, correo electrónico o analítica, bajo los correspondientes contratos y
        garantías. No se venden datos personales a terceros.
      </p>

      <h2 className="text-xl font-semibold mt-10 mb-3">6. Transferencias internacionales</h2>
      <p className="text-gray-700">
        Si algún proveedor tratara datos fuera del Espacio Económico Europeo, se adoptarán las garantías adecuadas
        exigidas por la normativa aplicable.
      </p>

      <h2 className="text-xl font-semibold mt-10 mb-3">7. Conservación de los datos</h2>
      <p className="text-gray-700">
        Los datos se conservarán durante el tiempo necesario para prestar el servicio, cumplir obligaciones legales y
        atender posibles reclamaciones.
        <br />
        En particular, las evidencias profesionales se conservarán mientras la verificación o credencial asociada
        permanezca activa, o hasta que proceda su supresión a solicitud del interesado, salvo cuando deban mantenerse
        por obligación legal, por motivos de seguridad o para la defensa frente a reclamaciones.
      </p>

      <h2 className="text-xl font-semibold mt-10 mb-3">8. Derechos de las personas interesadas</h2>
      <p className="text-gray-700">
        Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento,
        portabilidad y no ser objeto de decisiones individualizadas, cuando proceda, mediante solicitud a
        contacto@verijob.es. También puedes presentar reclamación ante la Agencia Española de Protección de Datos.
      </p>

      <h2 className="text-xl font-semibold mt-10 mb-3">9. Seguridad</h2>
      <p className="text-gray-700">
        VERIJOB aplica medidas técnicas y organizativas razonables para proteger la confidencialidad, integridad y
        disponibilidad de la información, incluyendo controles de acceso, separación por roles, trazabilidad y medidas
        de seguridad en el tratamiento de evidencias.
      </p>

      <h2 className="text-xl font-semibold mt-10 mb-3">10. Cambios</h2>
      <p className="text-gray-700">
        Podremos actualizar esta política para adaptarla a cambios normativos, técnicos o del servicio. La versión
        vigente estará siempre disponible en esta página.
      </p>
    </main>
  );
}
