import { NextResponse } from "next/server"
import QRCode from "qrcode"

export async function GET(req: Request, ctx: any) {
  const params = await ctx?.params
  const token = params?.token as string | undefined

  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 })
  }

  const url = `https://app.verijob.es/v/${token}`

  const svg = await QRCode.toString(url, {
    type: "svg",
    margin: 1,
    width: 256,
  })

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  })
}
