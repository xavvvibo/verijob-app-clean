import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import CandidateOperationsLayout from "@/components/candidate-v2/layouts/CandidateOperationsLayout";
import CandidatePageHeader from "@/components/candidate-v2/primitives/CandidatePageHeader";
import LanguagesClient from "./LanguagesClient";

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
    <CandidateOperationsLayout>
      <CandidatePageHeader
        eyebrow="Idiomas y logros"
        title="Refuerza tu perfil global"
        description="Añade idiomas y certificaciones para que las empresas entiendan mejor tu nivel y el tipo de señales que ya aportas."
        badges={["Idiomas visibles", "Certificados", "Señales complementarias"]}
      />

      <LanguagesClient initialItems={items || []} />
    </CandidateOperationsLayout>
  );
}
