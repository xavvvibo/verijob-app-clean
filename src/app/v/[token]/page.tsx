import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"
import { resolveCompanyDisplayName } from "@/lib/company/company-profile";
import { isUnavailableLifecycleStatus } from "@/lib/account/lifecycle";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function shortHash(text:string){
  const hash=crypto.createHash("sha256").update(text).digest("hex")
  return hash.slice(0,16)
}

function verifySignature(credentialId:string,signature:string){

  const secret=process.env.CREDENTIAL_SIGNING_KEY

  if(!secret) return false

  const expected=crypto
    .createHmac("sha256",secret)
    .update(credentialId)
    .digest("hex")
    .slice(0,24)

  return expected===signature
}

export default async function Page(ctx:any){

  const token=ctx?.params?.token

  if(!token){
    return(
      <div style={{padding:40,fontFamily:"sans-serif"}}>
        QR NO VÁLIDO O CADUCADO
      </div>
    )
  }

  const {data,error}=await supabase
    .from("verification_requests")
    .select("id,public_token,company_name_freeform,position,start_date,end_date,evidence_count,credential_signature")
    .eq("public_token",token)
    .maybeSingle()

  if(!data||error){
    return(
      <div style={{padding:40,fontFamily:"sans-serif"}}>
        QR NO VÁLIDO O CADUCADO
      </div>
    )
  }

  const credentialId=shortHash(token)

  const signature=data.credential_signature||""

  const valid=verifySignature(credentialId,signature)

  const { data: summary } = await supabase
    .from("verification_summary")
    .select("verification_id,candidate_id,trust_score,evidence_count,status")
    .eq("verification_id", data.id)
    .maybeSingle()

  const { data: candidateProfile } = summary?.candidate_id
    ? await supabase
        .from("candidate_profiles")
        .select("trust_score")
        .eq("user_id", summary.candidate_id)
        .maybeSingle()
    : { data: null as any }

  if (summary?.candidate_id) {
    const { data: profileLifecycle } = await supabase
      .from("profiles")
      .select("lifecycle_status")
      .eq("id", summary.candidate_id)
      .maybeSingle()
    if (isUnavailableLifecycleStatus((profileLifecycle as any)?.lifecycle_status)) {
      return(
        <div style={{padding:40,fontFamily:"sans-serif"}}>
          Esta credencial ya no esta disponible publicamente.
        </div>
      )
    }
  }

  const trustScore = Number(candidateProfile?.trust_score ?? summary?.trust_score ?? 0)
  const companyName = resolveCompanyDisplayName(data.company_name_freeform || null, "Tu empresa");

  return(

    <div style={{
      fontFamily:"sans-serif",
      maxWidth:760,
      margin:"60px auto",
      border:"1px solid #e5e7eb",
      borderRadius:16,
      padding:40
    }}>

      <h1 style={{fontSize:28,marginBottom:8}}>
        Credencial verificable VERIJOB
      </h1>

      <div style={{color:"#64748b",marginBottom:30}}>
        Credencial laboral verificable
      </div>

      <div style={{
        padding:16,
        borderRadius:12,
        background: valid ? "#ecfdf5" : "#fef2f2",
        marginBottom:30
      }}>

        {valid ? "✓ Credencial verificada" : "QR NO VÁLIDO O CADUCADO"}

      </div>

      <div style={{marginBottom:20}}>

        <strong>Empresa</strong><br/>
        {companyName}

      </div>

      <div style={{marginBottom:20}}>

        <strong>Puesto</strong><br/>
        {data.position||"—"}

      </div>

      <div style={{marginBottom:20}}>

        <strong>Periodo</strong><br/>
        {data.start_date||"—"} — {data.end_date||"Actual"}

      </div>

      <div style={{marginBottom:20}}>

        <strong>Evidencias verificadas</strong><br/>
        {(summary?.evidence_count ?? data.evidence_count) || 0}

      </div>

      <div style={{marginBottom:20}}>
        <strong>Trust Score</strong><br/>
        {trustScore}
      </div>

      <div style={{marginTop:40,fontSize:13,color:"#64748b"}}>

        Credential ID: {credentialId}

      </div>

      <div style={{fontSize:13,color:"#64748b"}}>

        Estado del sello: {valid ? "verificado" : "no valido"}

      </div>

    </div>

  )

}
