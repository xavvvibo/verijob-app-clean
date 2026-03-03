import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const code = sp.code;
  const next = sp.next ?? "/dashboard";

  if (!code) {
    redirect(`/login?error=missing_code&next=${encodeURIComponent(next)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    redirect(
      `/login?error=exchange_failed&err=${encodeURIComponent(
        error.message
      )}&next=${encodeURIComponent(next)}`
    );
  }

  redirect(next);
}
