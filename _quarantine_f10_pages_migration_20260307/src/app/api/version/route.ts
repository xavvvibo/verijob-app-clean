import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      vercel_env: process.env.VERCEL_ENV ?? null,
      git_commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      git_ref: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      git_msg: process.env.VERCEL_GIT_COMMIT_MESSAGE ?? null,
      now: new Date().toISOString(),
    },
    { status: 200 }
  );
}
