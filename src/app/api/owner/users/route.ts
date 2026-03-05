import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { trackEventAdmin } from "@/utils/analytics/trackEventAdmin";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const limitRaw = url.searchParams.get("limit") || "50";
    const offsetRaw = url.searchParams.get("offset") || "0";
    const limit = Math.min(Math.max(parseInt(limitRaw, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(offsetRaw, 10) || 0, 0);

    const supabase = await createRouteHandlerClient();

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      return NextResponse.json({ route_version: "owner-users-v5", error: "unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", userRes.user.id)
      .maybeSingle();

    if (profErr || !profile) {
      return NextResponse.json({ route_version: "owner-users-v5", error: "profile_not_found" }, { status: 403 });
    }
    if ((profile.role || "").toLowerCase() !== "owner") {
      return NextResponse.json({ route_version: "owner-users-v5", error: "forbidden" }, { status: 403 });
    }

    let query = supabase
      .from("profiles")
      .select("id, email, role, onboarding_completed, created_at, active_company_id", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (q) {
      // search on email/role/id
      query = query.or(`email.ilike.%${q}%,role.ilike.%${q}%,id.ilike.%${q}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { route_version: "owner-users-v5", error: "profiles_query_failed", details: error.message },
        { status: 400 }
      );
    }

    try {
      await trackEventAdmin({
        event_name: "owner_users_viewed",
        user_id: userRes.user.id,
        role: "owner",
        source: "api_owner_users",
        metadata: { q: q || null, limit, offset, returned: data?.length ?? 0, total: count ?? null },
      });
    } catch {}

    return NextResponse.json({
      route_version: "owner-users-v5",
      q,
      limit,
      offset,
      total: count ?? null,
      users: data ?? [],
    });
  } catch (e: any) {
    return NextResponse.json(
      { route_version: "owner-users-v5", error: "internal_error", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}
