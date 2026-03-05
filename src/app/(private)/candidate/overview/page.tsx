import { createClient } from "@/utils/supabase/server"

export default async function CandidateOverviewPage() {

const supabase = await createClient()

const {
data: { user }
} = await supabase.auth.getUser()

if (!user) {
return (
<div className="p-8">
No user session
</div>
)
}

const { data: profile } = await supabase
.from("profiles")
.select("full_name, cv_consistency_score")
.eq("id", user.id)
.single()

const { data: experiences } = await supabase
.from("profile_experiences")
.select("*")
.eq("user_id", user.id)
.order("start_date",{ascending:false})

return (

<div className="space-y-8 p-8">

<div className="bg-white border rounded-xl p-6">
<div className="text-xs text-gray-500">Dashboard candidato</div>
<div className="text-xl font-semibold mt-2">
{profile?.full_name ?? "Candidato"}
</div>

<div className="text-sm text-gray-600 mt-2">
CV Consistency Score:
<span className="font-semibold ml-1">
{profile?.cv_consistency_score ?? 0}
</span>
</div>
</div>

<div className="bg-white border rounded-xl p-6">
<h2 className="font-semibold mb-4">
CV verificado (IA)
</h2>

{experiences?.length ? (

<div className="space-y-4">

{experiences.map((exp:any,i:number)=>(
<div key={i} className="border rounded-lg p-4">

<div className="font-medium">
{exp.role_title}
</div>

<div className="text-sm text-gray-600">
{exp.company_name}
</div>

<div className="text-xs text-gray-500">
{exp.start_date || "?"} — {exp.end_date || "Present"}
</div>

</div>
))}

</div>

) : (

<div className="text-sm text-gray-600">
No hay CV estructurado todavía.
</div>

)}

</div>

</div>

)

}
