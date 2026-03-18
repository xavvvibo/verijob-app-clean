import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { resolveCandidateOnboardingCompleted } from "@/lib/auth/onboarding-state";
import { resolveAuthenticatedRouting } from "@/lib/auth/post-login-redirect";
import { resolveSessionRole } from "@/lib/auth/session-role";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export default async function AuthDebugPage() {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth?.user) {
    redirect("/login?next=/auth-debug");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,email,role,active_company_id,onboarding_completed")
    .eq("id", auth.user.id)
    .maybeSingle();

  const admin = createServiceRoleClient();
  const { data: profileColumns } = await admin
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", "profiles");
  const profileColumnSet = new Set((profileColumns || []).map((row: any) => String(row?.column_name || "")));

  const resolvedRole = resolveSessionRole({
    profileRole: profile?.role,
    activeCompanyId: (profile as any)?.active_company_id,
    user: auth.user,
  });

  const resolvedOnboardingCompleted = resolveCandidateOnboardingCompleted({
    onboarding_completed: (profile as any)?.onboarding_completed,
  });

  const routing = resolveAuthenticatedRouting({
    ...(profile || {}),
    user: auth.user,
  });

  const payload = {
    auth_user: {
      id: auth.user.id,
      email: auth.user.email || null,
    },
    profile: {
      role: profile?.role ?? null,
      app_role: null,
      active_company_id: (profile as any)?.active_company_id ?? null,
      onboarding_completed: (profile as any)?.onboarding_completed ?? null,
    },
    metadata: {
      app_metadata: auth.user.app_metadata || {},
      user_metadata: auth.user.user_metadata || {},
    },
    resolution: {
      session_role: resolvedRole,
      onboarding_completed: resolvedOnboardingCompleted,
      destination: routing.destination,
      routing_role: routing.role,
      routing_onboarding_completed: routing.onboardingCompleted,
      should_redirect: routing.shouldRedirect,
    },
    diagnostics: {
      profile_read_error: profileError?.message || null,
      profile_columns: {
        role: profileColumnSet.has("role"),
        app_role: profileColumnSet.has("app_role"),
        active_company_id: profileColumnSet.has("active_company_id"),
        onboarding_completed: profileColumnSet.has("onboarding_completed"),
      },
      generated_at: new Date().toISOString(),
    },
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Auth Debug</h1>
        <p className="mt-2 text-sm text-slate-600">
          Diagnóstico temporal de sesión y resolución de routing para el usuario autenticado actual.
        </p>
        <pre className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100">
          {prettyJson(payload)}
        </pre>
      </div>
    </main>
  );
}
