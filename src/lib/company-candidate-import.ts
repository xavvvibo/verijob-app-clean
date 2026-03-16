import { createServiceRoleClient } from "@/utils/supabase/service";

export async function importCandidateLanguages(candidate_id:string, parsed_payload:any){

  const supabase = createServiceRoleClient();

  if (!parsed_payload?.languages?.length){
    return;
  }

  const rows = parsed_payload.languages.map((lang:any)=>({
    user_id: candidate_id,
    language: lang.language,
    level: lang.level || null,
    source: "cv_parse"
  }));

  await supabase
    .from("candidate_languages")
    .insert(rows);

}
