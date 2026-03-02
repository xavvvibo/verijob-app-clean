import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL ?? "https://verijob.vercel.app"));
}
