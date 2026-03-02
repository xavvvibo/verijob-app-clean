import React from "react";
import { createClient } from "@/utils/supabase/server";
import { requireActiveSubscription } from "@/utils/billing/requireActiveSubscription";
import { redirect } from "next/navigation";

type Props = {
  children: React.ReactNode;
  redirectTo?: string;
};

export default async function RequireActiveSubscription({ children, redirectTo }: Props) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth?.user) redirect("/login");

  await requireActiveSubscription(supabase, auth.user.id, { redirectTo: redirectTo ?? "/company/upgrade" });

  return <>{children}</>;
}
