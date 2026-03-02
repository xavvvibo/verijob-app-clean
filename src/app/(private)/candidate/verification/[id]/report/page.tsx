import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import ShareLinkButton from "./ShareLinkButton";

type Summary = {
  verification_id: string;
  company_id: string | null;
  candidate_id: string | null;
  employment_record_id: string;
  requested_by: string;
  status: string;
  company_name_freeform: string | null;
  position: string | null;
  start_date: string | null;
  end_date: string | null;
  evidence_count: number;
  actions_count: number;
  company_confirmed: boolean;
  verification_level: "verified" | "in_review" | "rejected" | "partial" | string;
  submitted_at: string | null;
  resolved_at: string | null;
  created_at: string;
};

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function labelForLevel(level: string) {
  switch (level) {
    case "verified":
      return { title: "Verified", hint: "High confidence result" };
    case "in_review":
      return { title: "In review", hint: "Verification is being processed" };
    case "rejected":
      return { title: "Rejected", hint: "Verification did not pass" };
    case "partial":
    default:
      return { title: "Partial", hint: "Some elements are verified, others missing" };
  }
}

export default async function CandidateVerificationReportPage({
  params,
}: {
  params: any;
}) {
  const resolvedParams = await params;
  const verificationId = resolvedParams?.id as string | undefined;

  if (!verificationId || verificationId === "undefined" || !isUuid(verificationId)) {
    return (
      <div style={{ maxWidth: 880, margin: "0 auto", padding: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Invalid verification id</h1>
        <div style={{ marginTop: 10, opacity: 0.85 }}>
          Received: <code>{String(verificationId ?? null)}</code>
        </div>
        <div style={{ marginTop: 16 }}>
          <Link href="/candidate/verification" style={{ textDecoration: "underline" }}>
            Back
          </Link>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return (
      <div style={{ maxWidth: 880, margin: "0 auto", padding: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Unauthorized</h1>
        <div style={{ marginTop: 10, opacity: 0.85 }}>Please log in again.</div>
        <div style={{ marginTop: 16 }}>
          <Link href="/login" style={{ textDecoration: "underline" }}>
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  const { data, error } = await supabase
    .from("verification_summary")
    .select("*")
    .eq("verification_id", verificationId)
    .maybeSingle();

  if (error) {
    return (
      <div style={{ maxWidth: 880, margin: "0 auto", padding: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Error</h1>
        <div style={{ marginTop: 10, opacity: 0.85 }}>{error.message}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ maxWidth: 880, margin: "0 auto", padding: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Not found</h1>
        <div style={{ marginTop: 10, opacity: 0.85 }}>
          This verification doesn’t exist or you don’t have access.
        </div>
        <div style={{ marginTop: 16 }}>
          <Link href="/candidate/verification" style={{ textDecoration: "underline" }}>
            Back
          </Link>
        </div>
      </div>
    );
  }

  const s = data as Summary;
  const level = labelForLevel(s.verification_level);

  const companyLabel =
    s.company_name_freeform ||
    (s.company_id ? `Company ID: ${s.company_id}` : "Company not specified");

  const dateRange =
    s.start_date && s.end_date
      ? `${s.start_date} → ${s.end_date}`
      : s.start_date && !s.end_date
      ? `${s.start_date} → Present`
      : "Dates not provided";

  const whatIsVerified =
    s.verification_level === "verified"
      ? ["Employment relationship confirmed", "Evidence accepted"]
      : s.verification_level === "partial"
      ? ["Evidence received", "Basic data captured"]
      : s.verification_level === "in_review"
      ? ["Evidence received", "Awaiting review"]
      : ["Outcome recorded"];

  const whatIsMissing =
    s.verification_level === "partial"
      ? [
          "More evidence may be required to reach Verified",
          "Employer confirmation may be needed depending on the case",
        ]
      : s.verification_level === "in_review"
      ? ["Waiting for review completion"]
      : s.verification_level === "verified"
      ? []
      : [];

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Verification Report</div>
          <h1 style={{ margin: "8px 0 0", fontSize: 28 }}>{level.title}</h1>
          <div style={{ marginTop: 6, opacity: 0.8 }}>{level.hint}</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <ShareLinkButton verificationId={verificationId} />
          <Link href="/candidate/verification" style={{ textDecoration: "underline" }}>
            Back
          </Link>
        </div>
      </div>

      <div style={{ marginTop: 18, padding: 16, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Role</div>
            <div style={{ marginTop: 6, fontSize: 16 }}>{s.position ?? "Not specified"}</div>
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Company</div>
            <div style={{ marginTop: 6, fontSize: 16 }}>{companyLabel}</div>
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Dates</div>
            <div style={{ marginTop: 6, fontSize: 16 }}>{dateRange}</div>
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Evidence</div>
            <div style={{ marginTop: 6, fontSize: 16 }}>
              {s.evidence_count} file(s) • {s.actions_count} event(s)
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Employer confirmation</div>
            <div style={{ marginTop: 6, fontSize: 16 }}>
              {s.company_confirmed ? "Yes" : "Not yet"}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Verification ID</div>
            <div style={{ marginTop: 6, fontSize: 14, opacity: 0.85 }}>{s.verification_id}</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ padding: 16, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>What’s verified</div>
          <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>
            {whatIsVerified.map((x) => (
              <li key={x} style={{ marginBottom: 6 }}>{x}</li>
            ))}
          </ul>
        </div>

        <div style={{ padding: 16, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>What’s missing / next steps</div>
          {whatIsMissing.length === 0 ? (
            <div style={{ marginTop: 10, opacity: 0.85 }}>Nothing pending.</div>
          ) : (
            <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>
              {whatIsMissing.map((x) => (
                <li key={x} style={{ marginBottom: 6 }}>{x}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
