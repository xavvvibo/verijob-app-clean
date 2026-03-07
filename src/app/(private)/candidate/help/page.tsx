export const dynamic = "force-dynamic";

export default function CandidateHelpPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-extrabold text-slate-900">Ayuda</h1>
      <p className="mt-2 text-slate-600">
        Centro de ayuda del candidato. Aquí integraremos FAQ, guías rápidas y un botón para reportar incidencias.
      </p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="text-sm font-bold text-slate-900">Acciones rápidas</div>
        <ul className="mt-3 list-disc pl-5 text-sm text-slate-700 space-y-2">
          <li>Cómo subir CV y revisar experiencias detectadas de forma automática.</li>
          <li>Cómo adjuntar evidencias y asignarlas a experiencias.</li>
          <li>Cómo compartir tu perfil (token) y revocar el acceso.</li>
        </ul>
      </div>
    </div>
  );
}
