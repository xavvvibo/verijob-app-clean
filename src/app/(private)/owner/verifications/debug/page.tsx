import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { summarizeCompanyCvImportUpdates } from "@/lib/candidate/import-update-summary";

export const dynamic = "force-dynamic";

async function readColumns(admin: any, tableName: string) {
  const { data, error } = await admin
    .from("information_schema.columns")
    .select("column_name,ordinal_position")
    .eq("table_schema", "public")
    .eq("table_name", tableName)
    .order("ordinal_position", { ascending: true });

  return {
    error: error?.message || null,
    columns: Array.isArray(data) ? data.map((row: any) => String(row?.column_name || "")).filter(Boolean) : [],
  };
}

export default async function OwnerVerificationsDebugPage() {
  const sessionClient = await createServerSupabaseClient();
  const { data: auth } = await sessionClient.auth.getUser();
  if (!auth?.user) redirect("/login?next=/owner/verifications/debug");

  const { data: ownerProfile } = await sessionClient
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const ownerRole = String(ownerProfile?.role || "").toLowerCase();
  if (!["owner", "admin"].includes(ownerRole)) {
    redirect("/dashboard?forbidden=1&from=owner");
  }

  const admin = createServiceRoleClient();

  const [verificationColumns, employmentColumns, candidateProfileColumns, profilesColumns, verificationRowsRes, importRowsRes] = await Promise.all([
    readColumns(admin, "verification_requests"),
    readColumns(admin, "employment_records"),
    readColumns(admin, "candidate_profiles"),
    readColumns(admin, "profiles"),
    admin
      .from("verification_requests")
      .select("id,status,requested_by,company_id,employment_record_id,verification_channel,requested_at,created_at,updated_at,company_name_target", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("candidate_profiles")
      .select("user_id,updated_at,raw_cv_json")
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  const verificationRows = Array.isArray(verificationRowsRes.data) ? verificationRowsRes.data : [];
  const importRows = Array.isArray(importRowsRes.data) ? importRowsRes.data : [];

  const importsSummary = importRows
    .map((row: any) => ({
      user_id: row.user_id,
      updated_at: row.updated_at || null,
      summary: summarizeCompanyCvImportUpdates(row.raw_cv_json),
    }))
    .filter((row) => row.summary.importedFromCompanyCv || row.summary.updatesCount > 0);

  const payload = {
    generated_at: new Date().toISOString(),
    owner_user_id: auth.user.id,
    columns: {
      verification_requests: verificationColumns,
      employment_records: employmentColumns,
      candidate_profiles: candidateProfileColumns,
      profiles: profilesColumns,
    },
    verification_requests: {
      count: Number(verificationRowsRes.count || 0),
      error: verificationRowsRes.error?.message || null,
      latest: verificationRows,
    },
    candidate_imports: {
      count_with_updates: importsSummary.length,
      error: importRowsRes.error?.message || null,
      latest: importsSummary,
    },
  };

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Owner Debug · Verificaciones e imports</h1>
        <p className="mt-1 text-sm text-slate-600">
          Diagnóstico temporal server-side para contrastar el esquema real y las filas que existen en producción.
        </p>
      </div>
      <pre className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100">
        {JSON.stringify(payload, null, 2)}
      </pre>
    </div>
  );
}
