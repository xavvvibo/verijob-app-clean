import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const url = new URL(req.url);
  return NextResponse.redirect(new URL("/login", url.origin));
}
