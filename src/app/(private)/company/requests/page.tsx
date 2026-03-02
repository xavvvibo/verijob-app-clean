import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function CompanyRequestsPage(
  { searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }
) {
  const params = searchParams ? await searchParams : {};
  const statusFilter = typeof params?.status === "string" ? params.status : "all";
  const sort = typeof params?.sort === "string" ? params.sort : "desc";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_company_id, onboarding_completed")
    .eq("id", user.id)
    .single();

  if (!profile?.onboarding_completed) redirect("/onboarding");
  if (!profile?.active_company_id) redirect("/dashboard");

  // Cargamos todas para contar
  const { data: allData } = await supabase
    .from("verification_summary")
    .select("*")
    .eq("company_id", profile.active_company_id);

  const counts = {
    all: allData?.length || 0,
    reviewing: allData?.filter(r => r.status_effective === "reviewing").length || 0,
    verified: allData?.filter(r => r.status_effective === "verified").length || 0,
    revoked: allData?.filter(r => r.status_effective === "revoked").length || 0,
  };

  let filtered = allData || [];

  if (statusFilter !== "all") {
    filtered = filtered.filter(r => r.status_effective === statusFilter);
  }

  filtered = filtered.sort((a, b) => {
    if (!a.start_date || !b.start_date) return 0;
    return sort === "asc"
      ? new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      : new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
  });

  return (
    <div style={{ padding: 32, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>Verificaciones</h1>

      <div style={{ display: "flex", gap: 16, marginBottom: 24, fontWeight: 500 }}>
        <Link href="?status=all">Todas ({counts.all})</Link>
        <Link href="?status=reviewing">En revisión ({counts.reviewing})</Link>
        <Link href="?status=verified">Verificadas ({counts.verified})</Link>
        <Link href="?status=revoked">Revocadas ({counts.revoked})</Link>
        <Link href={`?status=${statusFilter}&sort=${sort === "asc" ? "desc" : "asc"}`}>
          Orden: {sort === "asc" ? "Asc" : "Desc"}
        </Link>
      </div>

      {filtered.length === 0 ? (
        <div style={{
          padding: 40,
          textAlign: "center",
          background: "#f9fafb",
          borderRadius: 8,
          border: "1px solid #e5e7eb"
        }}>
          No hay verificaciones en este estado.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
              <th style={{ padding: 12 }}>Verification ID</th>
              <th style={{ padding: 12 }}>Puesto</th>
              <th style={{ padding: 12 }}>Estado</th>
              <th style={{ padding: 12 }}>Inicio</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.verification_id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: 12 }}>
                  <Link href={`/company/verification/${row.verification_id}`}>
                    {row.verification_id.slice(0, 8)}
                  </Link>
                </td>
                <td style={{ padding: 12 }}>{row.position || "-"}</td>
                <td style={{ padding: 12 }}>
                  <span style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 600,
                    background:
                      row.status_effective === "verified" ? "#DCFCE7" :
                      row.status_effective === "reviewing" ? "#FEF9C3" :
                      row.status_effective === "revoked" ? "#FEE2E2" :
                      "#E5E7EB"
                  }}>
                    {row.status_effective}
                  </span>
                </td>
                <td style={{ padding: 12 }}>{row.start_date || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
