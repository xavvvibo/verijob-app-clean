import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import CompanyTeamClient from "./CompanyTeamClient";

export const dynamic = "force-dynamic";

export default async function CompanyTeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <CompanyTeamClient />;
}
