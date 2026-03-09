import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

type ReqRow = {
  verification_id: string;
  position: string | null;
  status_effective: string | null;
  start_date: string | null;
  company_name_freeform: string | null;
};

function statusLabel(v: string | null) {
  if (v === "verified") return "Verificada";
  if (v === "reviewing") return "En revisión";
  if (v === "revoked") return "Revocada";
  return "Sin estado";
}

function statusClass(v: string | null) {
  if (v === "verified") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (v === "reviewing") return "bg-amber-100 text-amber-800 border-amber-200";
  if (v === "revoked") return "bg-rose-100 text-rose-800 border-rose-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function formatDate(value: string | null) {
  if (!value) return "No disponible";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "No disponible";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function CompanyRequestsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const statusFilter = typeof params?.status === "string" ? params.status : "all";
  const sort = typeof params?.sort === "string" ? params.sort : "desc";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_company_id, onboarding_completed")
    .eq("id", user.id)
    .single();

  if (!profile?.onboarding_completed) redirect("/onboarding");
  if (!profile?.active_company_id) redirect("/company");

  const [{ data: allData }, { data: subData }] = await Promise.all([
    supabase
      .from("verification_summary")
      .select("verification_id,position,status_effective,start_date,company_name_freeform")
      .eq("company_id", profile.active_company_id),
    supabase
      .from("subscriptions")
      .select("plan,status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const planActive = ["active", "trialing"].includes(String(subData?.status || "").toLowerCase());

  const rows = (allData || []) as ReqRow[];
  const counts = {
    all: rows.length,
    reviewing: rows.filter((r) => r.status_effective === "reviewing").length,
    verified: rows.filter((r) => r.status_effective === "verified").length,
    revoked: rows.filter((r) => r.status_effective === "revoked").length,
  };

  let filtered = rows;
  if (statusFilter !== "all") filtered = rows.filter((r) => r.status_effective === statusFilter);

  filtered = filtered.sort((a, b) => {
    const da = a.start_date ? new Date(a.start_date).getTime() : 0;
    const db = b.start_date ? new Date(b.start_date).getTime() : 0;
    return sort === "asc" ? da - db : db - da;
  });

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Solicitudes y verificaciones</h1>
        <p className="mt-2 text-sm text-slate-600">
          Gestiona la cola operativa de tu empresa, prioriza revisiones y abre el detalle de cada verificación.
        </p>
        {!planActive ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Estás operando con acceso básico. Mejora tu plan para ampliar volumen y funciones avanzadas de revisión.
            <Link href="/company/upgrade" className="ml-2 font-semibold underline underline-offset-2">
              Ver opciones
            </Link>
          </div>
        ) : null}
      </section>

      <section className="flex flex-wrap gap-2">
        <Link href="?status=all" className={`rounded-full border px-3 py-1.5 text-sm ${statusFilter === "all" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200"}`}>
          Todas ({counts.all})
        </Link>
        <Link href="?status=reviewing" className={`rounded-full border px-3 py-1.5 text-sm ${statusFilter === "reviewing" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200"}`}>
          En revisión ({counts.reviewing})
        </Link>
        <Link href="?status=verified" className={`rounded-full border px-3 py-1.5 text-sm ${statusFilter === "verified" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200"}`}>
          Verificadas ({counts.verified})
        </Link>
        <Link href="?status=revoked" className={`rounded-full border px-3 py-1.5 text-sm ${statusFilter === "revoked" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200"}`}>
          Revocadas ({counts.revoked})
        </Link>
        <Link href={`?status=${statusFilter}&sort=${sort === "asc" ? "desc" : "asc"}`} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700">
          Orden: {sort === "asc" ? "Ascendente" : "Descendente"}
        </Link>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-600">
            No hay solicitudes en este estado. Cuando entren nuevas verificaciones, aparecerán aquí.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Verificación</th>
                  <th className="px-4 py-3">Puesto</th>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Inicio</th>
                  <th className="px-4 py-3">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.verification_id} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{row.verification_id.slice(0, 10)}…</td>
                    <td className="px-4 py-3 text-slate-900">{row.position || "No especificado"}</td>
                    <td className="px-4 py-3 text-slate-700">{row.company_name_freeform || "No especificada"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(row.status_effective)}`}>
                        {statusLabel(row.status_effective)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(row.start_date)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/company/verification/${row.verification_id}`} className="font-semibold text-slate-900 underline underline-offset-2">
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
