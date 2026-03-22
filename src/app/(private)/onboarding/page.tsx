import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/utils/supabase/server"
import { resolveCandidateOnboardingCompleted } from "@/lib/auth/onboarding-state"
import CandidateOnboardingFlow from "./CandidateOnboardingFlow"

export const dynamic = "force-dynamic"
export const revalidate = 0

function norm(value: unknown) {
  return String(value || "").trim().toLowerCase()
}

function matchKey(input: any) {
  return [
    norm(input?.role_title ?? input?.position),
    norm(input?.company_name ?? input?.company_name_freeform),
    norm(input?.start_date),
    norm(input?.end_date),
  ].join("|")
}

export default async function CandidateOnboardingPage() {
  const supabase = await createServerSupabaseClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) redirect("/login?next=/onboarding")

  const [{ data: profile }, { data: experiences }, { data: employmentRows }, { data: verificationRows }, { data: evidenceRows }, { data: candidateProfile }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,role,full_name,onboarding_step,onboarding_completed")
      .eq("id", auth.user.id)
      .maybeSingle(),
    supabase
      .from("profile_experiences")
      .select("id,role_title,company_name,start_date,end_date,description,matched_verification_id,created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("employment_records")
      .select("id,position,company_name_freeform,start_date,end_date,last_verification_request_id")
      .eq("candidate_id", auth.user.id),
    supabase
      .from("verification_requests")
      .select("id,status,requested_at,resolved_at,external_email_target,employment_record_id,created_at,revoked_at")
      .eq("requested_by", auth.user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("evidences")
      .select("id,verification_request_id,document_type,evidence_type,created_at,validation_status")
      .eq("uploaded_by", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("candidate_profiles")
      .select("trust_score")
      .eq("user_id", auth.user.id)
      .maybeSingle(),
  ])

  if (!profile) redirect("/login?next=/onboarding")

  const role = String(profile.role || "").toLowerCase()
  if (role === "company") redirect("/onboarding/company")

  if (resolveCandidateOnboardingCompleted(profile)) {
    redirect("/candidate/overview")
  }

  const employmentBySignature = new Map<string, string>()
  for (const row of employmentRows || []) {
    const key = matchKey(row)
    if (key && !employmentBySignature.has(key)) {
      employmentBySignature.set(key, String((row as any)?.id || ""))
    }
  }

  const mappedExperiences = (experiences || []).map((row: any) => ({
    id: String(row.id),
    profile_experience_id: String(row.id),
    employment_record_id: employmentBySignature.get(matchKey(row)) || "",
    role_title: row.role_title || "",
    company_name: row.company_name || "",
    start_date: row.start_date || "",
    end_date: row.end_date || "",
    description: row.description || "",
    matched_verification_id: row.matched_verification_id ? String(row.matched_verification_id) : "",
  }))

  const primaryExperience = mappedExperiences[0] || null
  const verificationByEmploymentId = new Map<string, any>()

  for (const row of verificationRows || []) {
    const key = String((row as any)?.employment_record_id || "")
    if (key && !verificationByEmploymentId.has(key) && !(row as any)?.revoked_at) {
      verificationByEmploymentId.set(key, row)
    }
  }

  const primaryVerification =
    (primaryExperience?.employment_record_id && verificationByEmploymentId.get(primaryExperience.employment_record_id)) ||
    ((verificationRows || []).find((row: any) => !(row as any)?.revoked_at) ?? null)

  return (
    <CandidateOnboardingFlow
      initialProfile={{
        fullName: String(profile.full_name || "").trim() || null,
        onboardingStep: String(profile.onboarding_step || "").trim() || null,
      }}
      initialExperience={primaryExperience}
      initialVerification={
        primaryVerification
          ? {
              id: String((primaryVerification as any).id || ""),
              status: String((primaryVerification as any).status || ""),
              requested_at: (primaryVerification as any).requested_at || null,
              resolved_at: (primaryVerification as any).resolved_at || null,
              external_email_target: String((primaryVerification as any).external_email_target || "").trim() || null,
              employment_record_id: String((primaryVerification as any).employment_record_id || "").trim() || null,
            }
          : null
      }
      initialEvidence={
        (evidenceRows || []).map((row: any) => ({
          id: String(row.id),
          document_type: String(row.document_type || row.evidence_type || "Documento"),
          created_at: row.created_at || null,
          validation_status: String(row.validation_status || "").trim() || null,
        }))
      }
      initialTrustScore={Number((candidateProfile as any)?.trust_score ?? 0) || 0}
    />
  )
}
