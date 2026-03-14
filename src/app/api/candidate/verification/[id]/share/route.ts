import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { trackEventAdmin } from "@/utils/analytics/trackEventAdmin";
import { isUnavailableLifecycleStatus } from "@/lib/account/lifecycle";

export async function POST(_req: Request, ctx: any) {
  const verificationId = ctx?.params?.id as string | undefined;
  if (!verificationId) {
    return NextResponse.json({ error: "missing_verification_id" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("lifecycle_status")
    .eq("id", user.id)
    .maybeSingle();
  if (isUnavailableLifecycleStatus((profile as any)?.lifecycle_status)) {
    return NextResponse.json(
      {
        error: "profile_unavailable",
        user_message: "Tu perfil esta desactivado o eliminado. Reactivalo antes de compartir verificaciones.",
      },
      { status: 423 }
    );
  }

  // 1) Idempotente: si existe token, lo reutiliza
  const { data: existing, error: existingErr } = await supabase
    .from("verification_public_links")
    .select("token, verification_id")
    .eq("verification_id", verificationId)
    .maybeSingle();

  if (existingErr) {
    return NextResponse.json({ error: "lookup_failed", detail: existingErr.message }, { status: 400 });
  }

  let token = (existing as any)?.token as string | undefined;

  // 2) Si no existe, crear
  if (!token) {
    const { data: created, error: createErr } = await supabase
      .from("verification_public_links")
      .insert({
        verification_id: verificationId,
        created_by: user.id,
      } as any)
      .select("token")
      .single();

    if (createErr) {
      return NextResponse.json({ error: "create_link_failed", detail: createErr.message }, { status: 400 });
    }

    token = (created as any)?.token as string | undefined;
  }

  // 3) Intentar resolver company_id (best-effort; si no aplica, null)
  let company_id: string | null = null;
  try {
    const { data: vr } = await supabase
      .from("verification_requests")
      .select("company_id")
      .eq("id", verificationId)
      .maybeSingle();
    company_id = (vr as any)?.company_id ?? null;
  } catch {
    company_id = null;
  }

  // 4) Canonical event server-side
  await trackEventAdmin({
    event_name: "verification_shared",
    user_id: user.id,
    company_id,
    metadata: {
      verification_id: verificationId,
      channel: "public_link",
      has_existing: Boolean((existing as any)?.token),
    },
  });

  return NextResponse.json({
    route_version: "candidate-verification-share-v1",
    verification_id: verificationId,
    token,
    public_url: `https://app.verijob.es/api/public/verification/${token}`,
  });
}
