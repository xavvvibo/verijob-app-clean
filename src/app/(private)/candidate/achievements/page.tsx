import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import LanguagesClient from "./LanguagesClient";
import CandidatePageHero from "../_components/CandidatePageHero";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();
  if (!au.user) redirect("/login");

  const { data: items } = await supabase
    .from("candidate_languages")
    .select("*")
    .eq("user_id", au.user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-[1280px] space-y-16 px-8 py-12">
      <CandidatePageHero
        eyebrow="Idiomas y logros"
        title="Refuerza tu perfil global"
        description="Añade idiomas y certificaciones para que las empresas entiendan mejor tu nivel y el tipo de señales que ya aportas."
        badges={["Idiomas visibles", "Certificados", "Señales complementarias"]}
        showTrustScore={false}
      />

      <LanguagesClient initialItems={items || []} />
    </div>
  );
}
