import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { noindex } from "../_seo/noindex";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export const metadata: Metadata = noindex;
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { children: React.ReactNode };

export default async function PrivateLayout({ children }: Props) {
  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();

  if (!au.user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", au.user.id)
    .maybeSingle();

  if (!profile?.onboarding_completed) {
    redirect("/onboarding");
  }

  return <>{children}</>;
}
