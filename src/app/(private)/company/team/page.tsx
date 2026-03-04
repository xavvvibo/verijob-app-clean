export const dynamic = "force-dynamic";

export default function CompanyTeamPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-extrabold text-slate-900">Equipo & Permisos</h1>
      <p className="mt-2 text-slate-600">
        Gestión de miembros de la empresa (admin / reviewer) y límites por plan.
      </p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="text-sm font-bold text-slate-900">Próximo</div>
        <ul className="mt-3 list-disc pl-5 text-sm text-slate-700 space-y-2">
          <li>Invitar usuarios por email.</li>
          <li>Asignar rol y revocar acceso.</li>
          <li>Hard limits por plan (Scale/Enterprise).</li>
        </ul>
      </div>
    </div>
  );
}
