import { createClient } from "@/utils/supabase/server";

export default async function CompanyDebugPage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user ?? null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, app_role")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const { data: memberships } = await supabase
    .from("company_members")
    .select("company_id, role")
    .limit(50);

  const { data: appRoleFn, error: appRoleFnError } = await supabase.rpc(
    "current_app_role"
  );
  const { data: isOwnerFn, error: isOwnerFnError } = await supabase.rpc(
    "is_owner"
  );

  return (
    <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Debug Session</h1>

      <section
        style={{
          marginTop: 14,
          padding: 14,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
        }}
      >
        <h2 style={{ fontSize: 16, margin: 0 }}>auth.getUser()</h2>
        <pre style={{ whiteSpace: "pre-wrap" }}>
{JSON.stringify(
  {
    id: user?.id,
    email: user?.email,
    aud: user?.aud,
  },
  null,
  2
)}
        </pre>
      </section>

      <section
        style={{
          marginTop: 14,
          padding: 14,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
        }}
      >
        <h2 style={{ fontSize: 16, margin: 0 }}>profiles (RLS)</h2>
        <pre style={{ whiteSpace: "pre-wrap" }}>
{JSON.stringify(profile, null, 2)}
        </pre>
      </section>

      <section
        style={{
          marginTop: 14,
          padding: 14,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
        }}
      >
        <h2 style={{ fontSize: 16, margin: 0 }}>
          company_members visibles (RLS)
        </h2>
        <pre style={{ whiteSpace: "pre-wrap" }}>
{JSON.stringify(
  { count: memberships?.length ?? 0, memberships },
  null,
  2
)}
        </pre>
      </section>

      <section
        style={{
          marginTop: 14,
          padding: 14,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
        }}
      >
        <h2 style={{ fontSize: 16, margin: 0 }}>RPC helpers</h2>
        <pre style={{ whiteSpace: "pre-wrap" }}>
{JSON.stringify(
  {
    current_app_role: appRoleFnError
      ? `ERROR: ${appRoleFnError.message}`
      : appRoleFn,
    is_owner: isOwnerFnError ? `ERROR: ${isOwnerFnError.message}` : isOwnerFn,
  },
  null,
  2
)}
        </pre>
      </section>
    </main>
  );
}
