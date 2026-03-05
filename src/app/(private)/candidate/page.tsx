import { createServerSupabaseClient } from "@/utils/supabase/server"
import CVStructured from "./_components/CVStructured"

export default async function CandidatePage() {

const supabase = await createServerSupabaseClient()

const {
data: { user }
} = await supabase.auth.getUser()

if (!user) {
return null
}

const { data: profile } = await supabase
.from("profiles")
.select("cv_consistency_score")
.eq("id", user.id)
.single()

const { data: experiences } = await supabase
.from("profile_experiences")
.select("*")
.eq("user_id", user.id)
.order("start_date",{ascending:false})

return (

<div className="space-y-8">

<CVStructured
experiences={experiences ?? []}
score={profile?.cv_consistency_score ?? 0}
/>

</div>

)

}
