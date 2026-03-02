import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient as createSbAdmin } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

function extractIdFromUrl(req: Request): string | null {
  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const i = parts.findIndex((p) => p === "verification");
    if (i >= 0 && parts[i + 1]) return parts[i + 1];
    return null;
  } catch {
    return null;
  }
}

const ROUTE_VERSION = "summary-v2-service-role-candidate-guard";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  // 1) Auth via SSR cookies (usuario actual)
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", route_version: ROUTE_VERSION }, { status: 401 });
  }

  // 2) Resolve verification id
  const params = await context.params;
  const idFromParams = params?.id ? String(params.id) : "";
  const idFromUrl = extractIdFromUrl(request) || "";
  const verificationId = (idFromParams || idFromUrl).trim();

  if (!verificationId) {
    return NextResponse.json({ error: "Missing verification id", route_version: ROUTE_VERSION }, { status: 400 });
  }

  // 3) Admin client (service role) para evitar 403 por RLS en view/joins
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL", route_version: ROUTE_VERSION },
      { status: 500 }
    );
  }

  const admin = createSbAdmin(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 4) Lee summary con service role
  const { data, error } = await admin
    .from("verification_summary")
    .select("*")
    .eq("verification_id", verificationId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: String(error.message || "Query error"), route_version: ROUTE_VERSION }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json({ error: "Not found", route_version: ROUTE_VERSION }, { status: 404 });
  }

  // 5) Guard: solo candidate dueño (por ahora)
  if (String((data as any).candidate_id) !== String(user.id)) {
    return NextResponse.json({ error: "Forbidden", route_version: ROUTE_VERSION }, { status: 403 });
  }

  return NextResponse.json({ data, route_version: ROUTE_VERSION });
}
