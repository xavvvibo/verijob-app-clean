"use client"

type Exp = {
company_name: string
role_title: string
start_date: string | null
end_date: string | null
description: string | null
}

export default function CVStructured({
experiences,
score
}:{
experiences: Exp[]
score: number
}) {

return (

<div className="bg-white border rounded-xl p-6">

<h2 className="text-lg font-semibold mb-4">
CV Verificado
</h2>

<div className="mb-4 text-sm text-slate-500">
Consistency score: <span className="font-semibold">{score}</span>
</div>

<div className="space-y-4">

{experiences.map((exp,i)=>(
<div key={i} className="border rounded-lg p-4">

<div className="font-medium">
{exp.role_title}
</div>

<div className="text-sm text-slate-500">
{exp.company_name}
</div>

<div className="text-xs text-slate-400">
{exp.start_date} — {exp.end_date ?? "Present"}
</div>

{exp.description && (
<div className="text-sm mt-2">
{exp.description}
</div>
)}

</div>
))}

</div>

</div>

)

}
