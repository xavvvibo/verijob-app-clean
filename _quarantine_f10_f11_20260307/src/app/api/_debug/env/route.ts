import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || null,
    SUPABASE_URL: process.env.SUPABASE_URL || null,
    VERCEL_ENV: process.env.VERCEL_ENV || null,
  });
}
