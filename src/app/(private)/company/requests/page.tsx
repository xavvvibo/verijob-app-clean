import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

type VerificationRequestRow = {
  id: string;
  requested_by: string | null;
  status: string | null;
  requested_at: string | null;
  resolved_at: string | null;
  company_name_target: string | null;
  employment_records:
    | {
        position: string | null;
        company_name_freeform: string | null;
        start_date: string | null;
        end_date: string | null;
      }
    | {
        position: string | null;
        company_name_freeform: string | null;
        start_date: string | null;
        end_date: string | null;
      }[]
    | null;
};

type ReqRow = {
  verification_id: string;
  candidate_id: string | null;
  candidate_name: string | null;
  position: string | null;
  status_effective: string | null;
  start_date: string | null;
  end_date: string | null;
  company_name_freeform: string | null;
};

function statusLabel(v: string | null) {
  if (v === "verified") return "Verificada";
  if (v === "requested" || v === "reviewing") return "En revisión";
  if (v === "company_registered_pending") return "Empresa registrada (pendiente)";
  if (v === "rejected") return "Rechazada";
  if (v === "revoked") return "Revocada";
  return "Sin estado";
}

function statusClass(v: string | null) {
  if (v === "verified") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (v === "requested" || v === "reviewing") return "bg-amber-100 text-amber-800 border-amber-200";
  if (v === "company_registered_pending") return "bg-indigo-100 text-indigo-800 border-indigo-200";
  if (v === "rejected" || v === "revoked") return "bg-rose-100 text-rose-800 border-rose-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function formatDate(value: string | null) {
  if (!value) return "No disponible";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "No disponible";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function periodLabel(startDate: string | null, endDate: string | null) {
  return `${formatDate(startDate)} — ${endDate ? formatDate(endDate) : "Actualidad"}`;
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
      .from("verification_requests")
      .select("id,requested_by,status,requested_at,resolved_at,company_name_target,employment_records(position,company_name_freeform,start_date,end_date)")
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

  const baseRows = (allData || []) as VerificationRequestRow[];
  const candidateIds = Array.from(new Set(baseRows.map((row) => row.requested_by).filter(Boolean))) as string[];
  const candidateNameMap = new Map<string, string>();

  if (candidateIds.length > 0) {
    const { data: candidateRows } = await supabase
      .from("profiles")
      .select("id,full_name")
      .in("id", candidateIds);

    for (const row of candidateRows || []) {
      candidateNameMap.set(String((row as any).id), String((row as any).full_name || ""));
    }
  }

  const rows: ReqRow[] = baseRows.map((row) => {
    const employment = Array.isArray(row.employment_records) ? row.employment_records[0] : row.employment_records;
    return {
      verification_id: row.id,
      candidate_id: row.requested_by,
      candidate_name: row.requested_by ? candidateNameMap.get(row.requested_by) || null : null,
      position: employment?.position || null,
      status_effective: row.status || null,
      start_date: employment?.start_date || null,
      end_date: employment?.end_date || null,
      company_name_freeform: employment?.company_name_freeform || row.company_name_target || null,
    };
  });

  const counts = {
    all: rows.length,
    reviewing: rows.filter((r) => r.status_effective === "reviewing" || r.status_effective === "requested").length,
    verified: rows.filter((r) => r.status_effective === "verified").length,
    revoked: rows.filter((r) => r.status_effective === "revoked" || r.status_effective === "rejected").length,
  };

  let filtered = rows;
  if (statusFilter !== "all") {
    if (statusFilter === "reviewing") {
      filtered = rows.filter((r) => r.status_effective === "reviewing" || r.status_effective === "requested");
    } else if (statusFilter === "revoked") {
      filtered = rows.filter((r) => r.status_effective === "revoked" || r.status_effective === "rejected");
    } else {
      filtered = rows.filter((r) => r.status_effective === statusFilter);
    }
  }

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
          Revisa solicitudes de verificación de experiencias laborales concretas: identifica candidato, periodo trabajado y resuelve en un solo paso.
        </p>
        {!planActive ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Tu empresa puede revisar y responder solicitudes de verificación en modo free. Mejora tu plan solo si quieres más capacidad premium en otras áreas.
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
            <p>
              Cuando un candidato solicite verificar una experiencia laboral en tu empresa, aparecerá aquí.
            </p>
            <p className="mt-2">
              Podrás confirmar o rechazar la experiencia en menos de 30 segundos.
            </p>
            <p className="mt-2 font-medium text-slate-700">
              Verificar experiencias es gratuito.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Verificación</th>
                  <th className="px-4 py-3">Candidato</th>
                  <th className="px-4 py-3">Experiencia</th>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Periodo</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.verification_id} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{row.verification_id.slice(0, 10)}…</td>
                    <td className="px-4 py-3 text-slate-700">{row.candidate_name || row.candidate_id || "Candidato"}</td>
                    <td className="px-4 py-3 text-slate-900">{row.position || "No especificado"}</td>
                    <td className="px-4 py-3 text-slate-700">{row.company_name_freeform || "No especificada"}</td>
                    <td className="px-4 py-3 text-slate-700">{periodLabel(row.start_date, row.end_date)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(row.status_effective)}`}>
                        {statusLabel(row.status_effective)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/company/verification/${row.verification_id}`} className="font-semibold text-slate-900 underline underline-offset-2">
                        Revisar y resolver
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
