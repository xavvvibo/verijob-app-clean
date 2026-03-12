import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { resolveActiveCandidatePublicLink } from "@/lib/public/candidate-public-link";

function isoDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function GET(_req: Request, ctx: any) {
  const params = await ctx?.params;
  const tokenParam = params?.token as string | undefined;

  const admin = createServiceRoleClient();

  const linkResolved = await resolveActiveCandidatePublicLink(admin, tokenParam);
  if (!linkResolved.ok) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const token = linkResolved.token;

  const base = process.env.NEXT_PUBLIC_APP_URL || "https://app.verijob.es";
  const url = `${base.replace(/\/$/, "")}/p/${token}`;

  const qrSvg = await QRCode.toString(url, {
    type: "svg",
    margin: 0,
    width: 320,
    errorCorrectionLevel: "M",
  });

  const inner = qrSvg.replace(/^[\s\S]*?<svg[^>]*>/i, "").replace(/<\/svg>\s*$/i, "");
  const stamp = isoDate();
  const tokenMark = token.slice(-8).toUpperCase();

  const branded = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="664" viewBox="0 0 512 664">
  <defs>
    <style>
      .t{font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;}
    </style>
  </defs>

  <rect x="0" y="0" width="512" height="664" rx="28" fill="#ffffff"/>
  <rect x="0" y="0" width="512" height="120" rx="28" fill="#0f2f72"/>
  <text x="40" y="55" class="t" font-size="22" font-weight="800" fill="#ffffff">VERIJOB</text>
  <text x="40" y="85" class="t" font-size="13" font-weight="600" fill="#dbe8ff">Perfil público verificable</text>

  <rect x="32" y="136" width="448" height="448" rx="24" fill="#ffffff" stroke="#e5e7eb" stroke-width="2"/>
  <g transform="translate(96,200)">
    <rect x="0" y="0" width="320" height="320" fill="#ffffff"/>
    ${inner}
  </g>

  <g transform="translate(256 360) rotate(-28)">
    <text text-anchor="middle" class="t" font-size="40" font-weight="900" fill="#0f172a" opacity="0.08">${stamp}</text>
  </g>

  <rect x="32" y="598" width="448" height="42" rx="10" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
  <text x="50" y="624" class="t" font-size="12" font-weight="700" fill="#0f172a">Escanea para validar este perfil en tiempo real</text>
  <text x="40" y="654" class="t" font-size="11" font-weight="600" fill="#64748b">Código único · ${tokenMark}</text>
</svg>`;

  return new NextResponse(branded, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}
