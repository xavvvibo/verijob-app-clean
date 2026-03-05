import { NextResponse } from "next/server"
import crypto from "crypto"

export async function POST(req: Request) {
  try {
    const { credentialId } = await req.json()
    if (!credentialId) {
      return NextResponse.json({ error: "missing_credential_id" }, { status: 400 })
    }

    const secret = process.env.CREDENTIAL_SIGNING_KEY
    if (!secret) {
      return NextResponse.json({ error: "missing_signing_key" }, { status: 500 })
    }

    const sig = crypto
      .createHmac("sha256", secret)
      .update(credentialId)
      .digest("hex")
      .slice(0, 24) // firma corta visible

    return NextResponse.json({ signature: sig })
  } catch {
    return NextResponse.json({ error: "sign_failed" }, { status: 500 })
  }
}
