import QRCode from "qrcode"

function isoDate() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export async function GET(req: Request, ctx: any) {
  const params = await ctx?.params
  const token = params?.token as string | undefined
  if (!token) return new Response("missing_token", { status: 400 })

  const url = `https://app.verijob.es/v/${token}`

  const qrSvg = await QRCode.toString(url, {
    type: "svg",
    margin: 0,
    width: 320,
    errorCorrectionLevel: "M",
  })

  const inner = qrSvg
    .replace(/^[\s\S]*?<svg[^>]*>/i, "")
    .replace(/<\/svg>\s*$/i, "")

  const stamp = isoDate()

  const branded = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="640" viewBox="0 0 512 640">
  <defs>
    <style>
      .t{font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;}
    </style>
  </defs>

  <rect x="0" y="0" width="512" height="640" rx="28" fill="#ffffff"/>

  <text x="40" y="64" class="t" font-size="18" font-weight="800" fill="#0f172a">VERIJOB</text>
  <text x="40" y="92" class="t" font-size="13" font-weight="600" fill="#475569">Credencial laboral verificable</text>

  <rect x="32" y="120" width="448" height="448" rx="24" fill="#ffffff" stroke="#e5e7eb" stroke-width="2"/>

  <g transform="translate(96,184)">
    <rect x="0" y="0" width="320" height="320" fill="#ffffff"/>
    ${inner}
  </g>

  <g transform="translate(256 344) rotate(-28)">
    <text text-anchor="middle" class="t" font-size="40" font-weight="900" fill="#0f172a" opacity="0.10">${stamp}</text>
  </g>

  <text x="40" y="604" class="t" font-size="12" font-weight="700" fill="#0f172a">Escanea para verificar en tiempo real</text>
  <text x="40" y="624" class="t" font-size="11" font-weight="600" fill="#64748b">${url}</text>
</svg>`

  return new Response(branded, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  })
}
