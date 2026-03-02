export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function CandidateSettingsPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold">Ajustes</h2>
      <p className="mt-2 text-sm text-gray-600">
        Preferencias y seguridad (lo activamos en el siguiente bloque).
      </p>

      <div className="mt-4 rounded-md border p-4">
        <div className="text-sm font-medium">Pendiente</div>
        <ul className="mt-2 text-xs text-gray-600 list-disc pl-5">
          <li>Cambio de contraseña</li>
          <li>Gestión de sesiones</li>
          <li>Preferencias de privacidad</li>
        </ul>
      </div>
    </div>
  );
}
