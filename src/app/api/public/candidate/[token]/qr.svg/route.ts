import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createServiceRoleClient } from "@/utils/supabase/service";

function isHex48(token: string) {
  return /^[a-f0-9]{48}$/i.test(token);
}

function isExpired(expiresAt?: string | null) {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return false;
  return t <= Date.now();
}

export async function GET(_req: Request, ctx: any) {
  const params = await ctx?.params;
  const token = params?.token as string | undefined;

  if (!token || !isHex48(token)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const admin = createServiceRoleClient();

  const { data: link, error } = await admin
    .from("candidate_public_links")
    .select("id,expires_at,is_active")
    .eq("public_token", token)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !link || isExpired(link.expires_at)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || "https://app.verijob.es";
  const url = `${base.replace(/\/$/, "")}/p/${token}`;

  const svg = await QRCode.toString(url, {
    type: "svg",
    margin: 1,
    width: 280,
  });

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
