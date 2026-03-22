import { createHash } from "crypto";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { CvExtractionError, extractCvTextFromBuffer } from "@/utils/cv/extractText";
import { normalizeCvLanguages } from "@/lib/candidate/cv-parse-normalize";
import {
  ensureCandidatePublicToken,
  extractStructuredCvFromBuffer,
  sha256Hex,
} from "@/lib/company-candidate-import";
import { resolveCompanyDisplayName } from "@/lib/company/company-profile";
import { buildCompanyCandidateImportInviteEmail } from "@/lib/email/templates/companyCandidateImportInvite";
import { sendTransactionalEmail } from "@/lib/email/sendTransactionalEmail";
import {
  buildEmploymentRecordDocumentaryPendingReviewUpdate,
  buildEmploymentRecordDocumentaryResolvedUpdate,
} from "@/lib/candidate/documentary-flow";
import {
  computeDocumentaryMatching,
  extractDocumentarySignals,
} from "@/lib/candidate/documentary-processing";
import { recalculateAndPersistCandidateTrustScore } from "@/server/trustScore/calculateTrustScore";
import {
  EVIDENCE_VALIDATION_INTERNAL,
  getEvidenceTypeConfig,
  normalizeEvidenceType,
  normalizeValidationStatus,
} from "@/lib/candidate/evidence-types";

type JobSummary = {
  kind: "candidate_cv" | "company_candidate_import" | "evidence_processing";
  id: string;
  state: "succeeded" | "failed" | "skipped" | "not_found";
  details?: string | null;
};

type EmailDispatchState = {
  ok: boolean;
  skipped?: boolean;
  error?: string | null;
};

type RunPendingJobsInput = {
  jobType?: "candidate_cv" | "company_candidate_import" | "evidence_processing" | "all";
  jobId?: string | null;
  limit?: number;
};

function getOpenAIKey(): string | null {
  return (
    process.env.OPENAI_API_KEY ||
    process.env.OPEN_API_KEY ||
    process.env.OPENAI_KEY ||
    null
  );
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeDateOnly(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function bucketPath(storagePath: string, bucket: string) {
  const prefix = `${bucket}/`;
  return storagePath.startsWith(prefix) ? storagePath.slice(prefix.length) : storagePath;
}

function buildCvExtractionPrompt(cvText: string) {
  return [
    "Extrae información estructurada de este CV en JSON válido.",
    "No inventes datos. Si no existe un campo, usa null o array vacío.",
    "Debes separar experiencia laboral y formación académica.",
    "",
    "Devuelve exactamente este objeto JSON:",
    "{",
    '  "full_name": string|null,',
    '  "email": string|null,',
    '  "phone": string|null,',
    '  "headline": string|null,',
    '  "languages": string[],',
    '  "achievements": [',
    "    {",
    '      "title": string|null,',
    '      "category": string|null,',
    '      "issuer": string|null,',
    '      "date": string|null,',
    '      "description": string|null',
    "    }",
    "  ],",
    '  "experiences": [',
    "    {",
    '      "company_name": string|null,',
    '      "role_title": string|null,',
    '      "start_date": string|null,',
    '      "end_date": string|null,',
    '      "location": string|null,',
    '      "description": string|null,',
    '      "skills": string[],',
    '      "confidence": number|null',
    "    }",
    "  ],",
    '  "education": [',
    "    {",
    '      "institution": string|null,',
    '      "title": string|null,',
    '      "study_field": string|null,',
    '      "start_date": string|null,',
    '      "end_date": string|null,',
    '      "description": string|null,',
    '      "confidence": number|null',
    "    }",
    "  ]",
    "}",
    "",
    "Texto del CV:",
    cvText,
  ].join("\n");
}

function readResponseOutputText(resp: any): string {
  if (typeof resp?.output_text === "string" && resp.output_text.trim()) return resp.output_text.trim();
  if (Array.isArray(resp?.output)) {
    for (const item of resp.output) {
      if (!Array.isArray(item?.content)) continue;
      for (const part of item.content) {
        if (part?.type === "output_text" && typeof part?.text === "string" && part.text.trim()) {
          return part.text.trim();
        }
      }
    }
  }
  return "";
}

function normalizeCvExtract(raw: any, cvText = "") {
  const experiences = Array.isArray(raw?.experiences) ? raw.experiences : [];
  const education = Array.isArray(raw?.education) ? raw.education : [];
  const achievements = Array.isArray(raw?.achievements) ? raw.achievements : [];
  return {
    full_name: normalizeText(raw?.full_name) || null,
    email: normalizeText(raw?.email) || null,
    phone: normalizeText(raw?.phone) || null,
    headline: normalizeText(raw?.headline) || null,
    languages: normalizeCvLanguages(Array.isArray(raw?.languages) ? raw.languages : [], 30, cvText),
    achievements: achievements
      .map((x: any) => ({
        title: normalizeText(x?.title) || null,
        category: normalizeText(x?.category) || null,
        issuer: normalizeText(x?.issuer) || null,
        date: normalizeText(x?.date) || null,
        description: normalizeText(x?.description) || null,
      }))
      .filter((x: any) => x.title || x.issuer || x.date || x.description),
    experiences: experiences.map((x: any) => ({
      company_name: normalizeText(x?.company_name) || null,
      role_title: normalizeText(x?.role_title) || null,
      start_date: normalizeText(x?.start_date) || null,
      end_date: normalizeText(x?.end_date) || null,
      location: normalizeText(x?.location) || null,
      description: normalizeText(x?.description) || null,
      skills: Array.isArray(x?.skills) ? x.skills.map((item: any) => normalizeText(item)).filter(Boolean) : [],
      confidence: typeof x?.confidence === "number" ? x.confidence : null,
    })),
    education: education.map((x: any) => ({
      institution: normalizeText(x?.institution) || null,
      title: normalizeText(x?.title) || null,
      study_field: normalizeText(x?.study_field) || null,
      start_date: normalizeText(x?.start_date) || null,
      end_date: normalizeText(x?.end_date) || null,
      description: normalizeText(x?.description) || null,
      confidence: typeof x?.confidence === "number" ? x.confidence : null,
    })),
  };
}

function buildCvWarnings(input: { cvText: string; experiences: any[]; education: any[]; languages?: string[] }) {
  const warnings: string[] = [];
  const plain = input.cvText.replace(/\s+/g, " ").trim();
  const wordCount = plain ? plain.split(" ").length : 0;

  if (plain.length < 400 || wordCount < 80) warnings.push("cv_text_insufficient");
  if ((input.experiences || []).length === 0) warnings.push("no_experiences_detected");
  if ((input.education || []).length === 0) warnings.push("no_education_detected");
  if (!Array.isArray(input.languages) || input.languages.length === 0) warnings.push("no_languages_detected");

  return { warnings, chars: plain.length, words: wordCount };
}

function buildRequestContextRetryableState(params: {
  currentContext: any;
  processing: Record<string, any>;
}) {
  return {
    ...(params.currentContext && typeof params.currentContext === "object" ? params.currentContext : {}),
    documentary_processing: {
      ...params.processing,
    },
  };
}

async function processCandidateCvParseJob(jobId: string): Promise<JobSummary> {
  console.info("CV_PARSE_JOB_START", { jobId });
  const supabase = createServiceRoleClient() as any;
  const { data: job, error: jobErr } = await supabase
    .from("cv_parse_jobs")
    .select("id,user_id,cv_upload_id,status")
    .eq("id", jobId)
    .maybeSingle();

  if (jobErr) {
    console.error("CV_PARSE_JOB_QUERY_FAILED", { jobId, error: jobErr.message });
    return { kind: "candidate_cv", id: jobId, state: "failed", details: jobErr.message };
  }
  if (!job?.id) {
    console.error("CV_PARSE_JOB_NOT_FOUND", { jobId });
    return { kind: "candidate_cv", id: jobId, state: "not_found" };
  }
  if (String(job.status || "").toLowerCase() === "succeeded") {
    console.info("CV_PARSE_JOB_SKIPPED", { jobId, reason: "already_succeeded" });
    return { kind: "candidate_cv", id: jobId, state: "skipped", details: "already_succeeded" };
  }

  try {
    await supabase
      .from("cv_parse_jobs")
      .update({
        status: "processing",
        started_at: new Date().toISOString(),
        finished_at: null,
        error: null,
      })
      .eq("id", job.id);
    console.info("CV_PARSE_JOB_MARKED_PROCESSING", { jobId });

    const { data: upload, error: uploadErr } = await supabase
      .from("cv_uploads")
      .select("*")
      .eq("id", job.cv_upload_id)
      .single();

    if (uploadErr || !upload) {
      throw new Error(`upload_not_found:${uploadErr?.message || "missing_upload"}`);
    }
    console.info("CV_PARSE_JOB_UPLOAD_LOADED", {
      jobId,
      uploadId: job.cv_upload_id,
      storageBucket: upload.storage_bucket,
      storagePath: upload.storage_path,
    });

    const normalizedStoragePath = bucketPath(String(upload.storage_path || ""), String(upload.storage_bucket || ""));
    const { data: file, error: downloadErr } = await supabase.storage
      .from(String(upload.storage_bucket))
      .download(normalizedStoragePath);

    if (downloadErr || !file) {
      throw new Error(`file_download_failed:${downloadErr?.message || "missing_file"}`);
    }
    console.info("CV_PARSE_STORAGE_DOWNLOAD_OK", {
      jobId,
      storageBucket: upload.storage_bucket,
      storagePath: normalizedStoragePath,
    });

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const effectiveFilename = upload.original_filename || upload.storage_path?.split("/").pop() || "cv_upload.pdf";

    let extractedText = "";
    try {
      extractedText = (await extractCvTextFromBuffer(fileBuffer, effectiveFilename)).trim();
      console.info("CV_PARSE_PDF_READ_OK", {
        jobId,
        filename: effectiveFilename,
        chars: extractedText.length,
      });
    } catch (error: any) {
      if (error instanceof CvExtractionError) {
        throw new Error(`${error.code}:${error.message}`);
      }
      throw error;
    }
    if (!extractedText) throw new Error("empty_cv_text");

    const openaiKey = getOpenAIKey();
    if (!openaiKey) throw new Error("missing_openai_api_key");

    const prompt = buildCvExtractionPrompt(extractedText.slice(0, 120000));
    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
        text: { format: { type: "json_object" } },
        temperature: 0,
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`openai_response_failed_${resp.status}:${txt.slice(0, 300)}`);
    }

    const raw = await resp.json();
    const outputText = readResponseOutputText(raw);
    if (!outputText) throw new Error("openai_no_output_text");

    let parsed: any = null;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      throw new Error("openai_invalid_json_output");
    }

    const normalized = normalizeCvExtract(parsed, extractedText);
    console.info("CV_PARSE_EXTRACTION_DONE", {
      jobId,
      experiences: normalized.experiences.length,
      education: normalized.education.length,
      languages: Array.isArray(normalized.languages) ? normalized.languages.length : 0,
      achievements: Array.isArray(normalized.achievements) ? normalized.achievements.length : 0,
    });
    const warningData = buildCvWarnings({
      cvText: extractedText,
      experiences: normalized.experiences,
      education: normalized.education,
      languages: normalized.languages,
    });

    await supabase
      .from("cv_parse_jobs")
      .update({
        status: "succeeded",
        finished_at: new Date().toISOString(),
        error: null,
        result_json: {
          ...normalized,
          meta: {
            model: raw?.model ?? "gpt-4.1-mini",
            input_tokens: raw?.usage?.input_tokens ?? null,
            output_tokens: raw?.usage?.output_tokens ?? null,
            warnings: warningData.warnings,
            extracted_text_chars: warningData.chars,
            extracted_text_words: warningData.words,
            processing_mode: "background_job",
          },
        },
      })
      .eq("id", job.id);
    console.info("CV_PARSE_RESULT_PERSISTED", {
      jobId,
      warnings: warningData.warnings,
    });
    console.info("CV_PARSE_JOB_COMPLETED", { jobId });

    return { kind: "candidate_cv", id: jobId, state: "succeeded" };
  } catch (error: any) {
    console.error("CV_PARSE_JOB_FAILED", {
      jobId,
      error: String(error?.message || error),
    });
    await supabase
      .from("cv_parse_jobs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error: String(error?.message || error).slice(0, 1000),
        result_json: {
          meta: {
            retryable: true,
            processing_mode: "background_job",
            failed_at: new Date().toISOString(),
          },
        },
      })
      .eq("id", job.id);

    return {
      kind: "candidate_cv",
      id: jobId,
      state: "failed",
      details: String(error?.message || error),
    };
  }
}

async function processCompanyCandidateImportJob(inviteId: string): Promise<JobSummary> {
  const supabase = createServiceRoleClient() as any;
  const { data: invite, error: inviteErr } = await supabase
    .from("company_candidate_import_invites")
    .select("*")
    .eq("id", inviteId)
    .maybeSingle();

  if (inviteErr) {
    return { kind: "company_candidate_import", id: inviteId, state: "failed", details: inviteErr.message };
  }
  if (!invite?.id) {
    return { kind: "company_candidate_import", id: inviteId, state: "not_found" };
  }

  const currentParseStatus = normalizeText(invite.parse_status).toLowerCase();
  const currentEmailStatus = normalizeText(invite.email_delivery_status).toLowerCase();
  if (currentParseStatus === "parsed_ready" && ["sent", "skipped"].includes(currentEmailStatus)) {
    return { kind: "company_candidate_import", id: inviteId, state: "skipped", details: "already_processed" };
  }

  try {
    await supabase
      .from("company_candidate_import_invites")
      .update({
        parse_status: currentParseStatus === "parsed_ready" ? "parsed_ready" : "processing",
        updated_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", invite.id);

    const { data: company } = await supabase
      .from("companies")
      .select("id,name,company_profiles(trade_name,legal_name)")
      .eq("id", invite.company_id)
      .maybeSingle();

    const companyProfile = Array.isArray(company?.company_profiles)
      ? company.company_profiles[0]
      : company?.company_profiles || null;
    const companyName = resolveCompanyDisplayName(
      {
        ...(company || {}),
        ...(companyProfile || {}),
      },
      "Tu empresa"
    );

    const existingCandidateUserId = normalizeText(invite.linked_user_id) || null;
    const existingCandidatePublicToken = existingCandidateUserId
      ? await ensureCandidatePublicToken(supabase, existingCandidateUserId)
      : null;

    let parseStatus = currentParseStatus === "parsed_ready" ? "parsed_ready" : "parse_failed";
    let extractedPayload: any =
      invite.extracted_payload_json && typeof invite.extracted_payload_json === "object"
        ? invite.extracted_payload_json
        : {};
    let extractedWarnings = Array.isArray(invite.extracted_warnings) ? invite.extracted_warnings : [];
    let parseError: string | null = null;

    if (currentParseStatus !== "parsed_ready") {
      try {
        const normalizedStoragePath = bucketPath(String(invite.storage_path || ""), String(invite.storage_bucket || ""));
        const { data: file, error: downloadErr } = await supabase.storage
          .from(String(invite.storage_bucket))
          .download(normalizedStoragePath);

        if (downloadErr || !file) {
          throw new Error(`file_download_failed:${downloadErr?.message || "missing_file"}`);
        }

        const bytes = Buffer.from(await file.arrayBuffer());
        const openaiApiKey = normalizeText(getOpenAIKey());
        if (!openaiApiKey) throw new Error("missing_openai_api_key");

        const parsed = await extractStructuredCvFromBuffer({
          fileBuffer: bytes,
          filename: invite.original_filename || "cv",
          openaiApiKey,
        });

        parseStatus = "parsed_ready";
        extractedWarnings = Array.isArray(parsed.warnings) ? parsed.warnings : [];
        extractedPayload = {
          ...parsed.extracted,
          _verijob_import_meta: {
            candidate_already_exists: Boolean(existingCandidateUserId),
            existing_candidate_user_id: existingCandidateUserId,
            existing_candidate_public_token: existingCandidatePublicToken,
            cv_sha256: parsed.cv_sha256 || sha256Hex(bytes),
            processing_mode: "background_job",
          },
        };
      } catch (error: any) {
        parseStatus = "parse_failed";
        parseError = String(error?.message || error);
        extractedPayload = {
          ...extractedPayload,
          _verijob_import_meta: {
            ...((extractedPayload && typeof extractedPayload === "object" && extractedPayload._verijob_import_meta) || {}),
            candidate_already_exists: Boolean(existingCandidateUserId),
            existing_candidate_user_id: existingCandidateUserId,
            existing_candidate_public_token: existingCandidatePublicToken,
            processing_mode: "background_job",
          },
        };
      }
    }

    const appUrl = normalizeText(process.env.NEXT_PUBLIC_APP_URL) || "https://app.verijob.es";
    const acceptanceLink = `${appUrl.replace(/\/$/, "")}/company-candidate-import/${invite.invite_token}`;

    let emailRes: EmailDispatchState | null =
      currentEmailStatus === "sent"
        ? { ok: true, skipped: false, error: null }
        : currentEmailStatus === "skipped"
          ? { ok: false, skipped: true, error: "email_provider_not_configured" }
          : null;

    if (!emailRes && !["accepted", "converted"].includes(normalizeText(invite.status).toLowerCase())) {
      const emailTemplate = buildCompanyCandidateImportInviteEmail({
        companyName,
        candidateEmail: String(invite.candidate_email || ""),
        candidateName: normalizeText(invite.candidate_name_raw) || null,
        targetRole: normalizeText(invite.target_role) || null,
        acceptanceLink,
      });
      emailRes = await sendTransactionalEmail({
        to: String(invite.candidate_email || ""),
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text,
      });
    }

    const emailDeliveryStatus = emailRes?.ok ? "sent" : emailRes?.skipped ? "skipped" : emailRes ? "failed" : currentEmailStatus || "pending";
    const nextStatus = emailRes?.ok
      ? ["accepted", "converted"].includes(normalizeText(invite.status).toLowerCase())
        ? invite.status
        : "emailed"
      : invite.status || "uploaded";
    const nextError = parseError || emailRes?.error || null;

    await supabase
      .from("company_candidate_import_invites")
      .update({
        parse_status: parseStatus,
        extracted_payload_json: extractedPayload,
        extracted_warnings: extractedWarnings,
        status: nextStatus,
        email_delivery_status: emailDeliveryStatus,
        emailed_at: emailRes?.ok ? new Date().toISOString() : invite.emailed_at || null,
        last_error: nextError,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invite.id);

    return {
      kind: "company_candidate_import",
      id: inviteId,
      state: parseStatus === "parse_failed" ? "failed" : "succeeded",
      details: nextError,
    };
  } catch (error: any) {
    await supabase
      .from("company_candidate_import_invites")
      .update({
        parse_status: "parse_failed",
        last_error: String(error?.message || error).slice(0, 1000),
        updated_at: new Date().toISOString(),
      })
      .eq("id", invite.id);

    return {
      kind: "company_candidate_import",
      id: inviteId,
      state: "failed",
      details: String(error?.message || error),
    };
  }
}

async function processEvidenceDocumentJob(evidenceId: string): Promise<JobSummary> {
  console.info("EVIDENCE_BG_JOB_START", { evidenceId });
  const supabase = createServiceRoleClient() as any;
  const { data: evidence, error: evidenceErr } = await supabase
    .from("evidences")
    .select("id, verification_request_id, storage_path, evidence_type, document_type, document_scope, trust_weight, uploaded_by, validation_status, inconsistency_reason")
    .eq("id", evidenceId)
    .maybeSingle();

  if (evidenceErr) {
    console.error("EVIDENCE_BG_JOB_EVIDENCE_LOOKUP_FAILED", {
      evidenceId,
      error: evidenceErr.message,
    });
    return { kind: "evidence_processing", id: evidenceId, state: "failed", details: evidenceErr.message };
  }
  if (!evidence?.id) {
    console.error("EVIDENCE_BG_JOB_EVIDENCE_NOT_FOUND", { evidenceId });
    return { kind: "evidence_processing", id: evidenceId, state: "not_found" };
  }
  console.info("EVIDENCE_BG_JOB_EVIDENCE_LOADED", {
    evidenceId,
    verificationRequestId: evidence.verification_request_id,
    storagePath: evidence.storage_path,
    validationStatus: evidence.validation_status,
  });

  const { data: vr, error: vrErr } = await supabase
    .from("verification_requests")
    .select("id, company_id, employment_record_id, requested_by, request_context")
    .eq("id", evidence.verification_request_id)
    .maybeSingle();

  if (vrErr || !vr?.id) {
    console.error("EVIDENCE_BG_JOB_REQUEST_LOOKUP_FAILED", {
      evidenceId,
      verificationRequestId: evidence.verification_request_id,
      error: vrErr?.message || "verification_request_not_found",
    });
    return {
      kind: "evidence_processing",
      id: evidenceId,
      state: "failed",
      details: vrErr?.message || "verification_request_not_found",
    };
  }

  const priorProcessing =
    vr.request_context && typeof vr.request_context === "object"
      ? (vr.request_context as any).documentary_processing || {}
      : {};
  if (String(priorProcessing?.processed_at || "").trim() && !["uploaded", "auto_processing"].includes(String(evidence.validation_status || "").toLowerCase())) {
    console.info("EVIDENCE_BG_JOB_SKIPPED", {
      evidenceId,
      reason: "already_processed",
      validationStatus: evidence.validation_status,
    });
    return { kind: "evidence_processing", id: evidenceId, state: "skipped", details: "already_processed" };
  }

  const evidenceType = normalizeEvidenceType(evidence.document_type || evidence.evidence_type);
  const evidenceConfig = getEvidenceTypeConfig(evidenceType);
  const processingStartedAt = new Date().toISOString();

  await supabase
    .from("evidences")
    .update({
      validation_status: EVIDENCE_VALIDATION_INTERNAL.AUTO_PROCESSING,
      document_type: evidenceType,
      document_scope: evidenceConfig.scope,
      trust_weight: evidenceConfig.trustWeight,
      inconsistency_reason: null,
    })
    .eq("id", evidence.id);

  await supabase
    .from("verification_requests")
    .update({
      request_context: buildRequestContextRetryableState({
        currentContext: vr.request_context,
        processing: {
          ...(priorProcessing && typeof priorProcessing === "object" ? priorProcessing : {}),
          mode: "evidence",
          status: "processing",
          processor: "background_job",
          processing_started_at: processingStartedAt,
          processed_at: null,
          retryable: true,
          error: null,
        },
      }),
    })
    .eq("id", vr.id);
  console.info("EVIDENCE_BG_JOB_MARKED_PROCESSING", {
    evidenceId,
    verificationRequestId: vr.id,
    processingStartedAt,
  });

  let documentaryProcessing: any = {
    ...(priorProcessing && typeof priorProcessing === "object" ? priorProcessing : {}),
    mode: "evidence",
    status: "processing",
    processor: "background_job",
    processing_started_at: processingStartedAt,
    link_state: "suggested_review",
    needs_manual_review: true,
    extraction: null,
    matching: null,
    error: null,
    fallback_text_mode: false,
    retryable: true,
  };
  let finalValidationStatus = EVIDENCE_VALIDATION_INTERNAL.NEEDS_REVIEW;
  let finalInconsistencyReason: string | null = null;
  let finalDocumentIssueDate: string | null = null;

  try {
    const { data: fileBlob, error: downloadErr } = await supabase.storage
      .from("evidence")
      .download(String(evidence.storage_path || ""));

    if (downloadErr || !fileBlob) {
      throw new Error(`evidence_download_failed:${downloadErr?.message || "missing_blob"}`);
    }
    console.info("EVIDENCE_BG_JOB_STORAGE_DOWNLOAD_OK", {
      evidenceId,
      storagePath: evidence.storage_path,
    });

    const fileBuffer = Buffer.from(await fileBlob.arrayBuffer());
    const fileName = String(String(evidence.storage_path || "").split("/").pop() || "evidence_document");
    const evidenceMime =
      fileName.toLowerCase().endsWith(".pdf")
        ? "application/pdf"
        : fileName.toLowerCase().endsWith(".jpg") || fileName.toLowerCase().endsWith(".jpeg")
          ? "image/jpeg"
          : fileName.toLowerCase().endsWith(".png")
            ? "image/png"
            : fileName.toLowerCase().endsWith(".webp")
              ? "image/webp"
              : "application/octet-stream";
    const openaiKey = getOpenAIKey();
    if (!openaiKey) throw new Error("missing_openai_api_key");

    const [{ data: employmentRows }, { data: profileRow }] = await Promise.all([
      supabase
        .from("employment_records")
        .select("id,position,company_name_freeform,start_date,end_date")
        .eq("candidate_id", evidence.uploaded_by),
      supabase.from("profiles").select("full_name").eq("id", evidence.uploaded_by).maybeSingle(),
    ]);

    const extractionResult = await extractDocumentarySignals({
      fileBuffer,
      fileName,
      mimeType: evidenceMime,
      openaiApiKey: openaiKey,
      textFallbackExtractor: extractCvTextFromBuffer,
    });
    console.info("EVIDENCE_BG_JOB_EXTRACTION_DONE", {
      evidenceId,
      provider: extractionResult.provider,
      fallbackTextUsed: Boolean(extractionResult.fallbackTextUsed),
      warning: extractionResult.warning || null,
    });

    const matching = computeDocumentaryMatching({
      extraction: extractionResult.extraction,
      employmentRecords: Array.isArray(employmentRows) ? employmentRows : [],
      candidateName: profileRow?.full_name || null,
    });
    console.info("EVIDENCE_BG_JOB_MATCH_DONE", {
      evidenceId,
      overallMatchLevel: matching.overall_match_level,
      overallMatchScore: matching.overall_match_score ?? matching.final_score ?? 0,
      autoLink: Boolean(matching.auto_link),
      inconsistencyReason: matching.inconsistency_reason || null,
    });

    documentaryProcessing = {
      ...documentaryProcessing,
      status: "processed",
      extraction: extractionResult.extraction,
      matching,
      extracted_company_name: extractionResult.extraction?.company_name || null,
      extracted_position: extractionResult.extraction?.job_title || null,
      extracted_start_date: extractionResult.extraction?.start_date || null,
      extracted_end_date: extractionResult.extraction?.end_date || null,
      extracted_person_name: extractionResult.extraction?.candidate_name || null,
      extracted_doc_type_confidence: extractionResult.extraction?.confidence_score ?? null,
      extraction_confidence: extractionResult.extraction?.confidence_score ?? null,
      processing_status: "processed",
      processing_summary: matching.matching_reason || null,
      company_match_score: matching.company_match_score ?? 0,
      position_match_score: matching.position_match_score ?? 0,
      date_match_score: matching.date_match_score ?? 0,
      person_match_score: matching.person_match_score ?? 0,
      overall_match_score: matching.overall_match_score ?? matching.final_score ?? 0,
      overall_match_level: matching.overall_match_level || "inconclusive",
      mismatch_flags: Array.isArray(matching.mismatch_flags) ? matching.mismatch_flags : [],
      link_state: matching.link_state,
      needs_manual_review: matching.needs_manual_review,
      matching_reason: matching.matching_reason,
      inconsistency_reason: matching.inconsistency_reason || null,
      fallback_text_mode: Boolean(extractionResult.fallbackTextUsed),
      warning: extractionResult.warning || null,
      provider: extractionResult.provider,
      model: extractionResult.model,
      evidence_type: evidenceType,
      trust_weight: evidenceConfig.trustWeight,
      evidence_scope: evidenceConfig.scope,
      retryable: false,
      error: null,
    };
    finalValidationStatus = matching.auto_link
      ? EVIDENCE_VALIDATION_INTERNAL.APPROVED
      : matching.inconsistency_reason
        ? EVIDENCE_VALIDATION_INTERNAL.REJECTED
        : EVIDENCE_VALIDATION_INTERNAL.NEEDS_REVIEW;
    finalInconsistencyReason = matching.inconsistency_reason || null;
    finalDocumentIssueDate = normalizeDateOnly(extractionResult?.extraction?.issue_date);

    const bestMatchId = normalizeText(matching?.best_match?.employment_record_id) || null;
    const currentEmploymentRecordId = normalizeText(vr.employment_record_id) || null;
    const linkedEmploymentRecordId =
      matching.auto_link && bestMatchId ? bestMatchId : currentEmploymentRecordId;

    if (matching.auto_link && linkedEmploymentRecordId) {
      if (linkedEmploymentRecordId !== currentEmploymentRecordId) {
        await supabase
          .from("verification_requests")
          .update({ employment_record_id: linkedEmploymentRecordId })
          .eq("id", vr.id);
      }

      const employmentUpdate = buildEmploymentRecordDocumentaryResolvedUpdate({
        verificationRequestId: vr.id,
        nowIso: new Date().toISOString(),
      });
      await supabase
        .from("employment_records")
        .update(employmentUpdate)
        .eq("id", linkedEmploymentRecordId)
        .eq("candidate_id", evidence.uploaded_by);
    } else if (currentEmploymentRecordId) {
      const pendingUpdate = buildEmploymentRecordDocumentaryPendingReviewUpdate({
        verificationRequestId: vr.id,
        nowIso: new Date().toISOString(),
      });
      await supabase
        .from("employment_records")
        .update(pendingUpdate)
        .eq("id", currentEmploymentRecordId)
        .eq("candidate_id", evidence.uploaded_by);
    }
  } catch (error: any) {
    console.error("EVIDENCE_BG_JOB_FAILED", {
      evidenceId,
      error: String(error?.message || error),
    });
    documentaryProcessing = {
      ...documentaryProcessing,
      status: "failed",
      processing_status: "failed",
      processing_summary: "No pudimos completar el análisis automático.",
      overall_match_level: "inconclusive",
      mismatch_flags: [],
      link_state: "suggested_review",
      needs_manual_review: true,
      retryable: true,
      error: String(error?.message || error),
    };
    finalValidationStatus = EVIDENCE_VALIDATION_INTERNAL.NEEDS_REVIEW;
    finalInconsistencyReason = null;
  }

  await supabase
    .from("verification_requests")
    .update({
      request_context: buildRequestContextRetryableState({
        currentContext: vr.request_context,
        processing: {
          ...documentaryProcessing,
          processed_at: new Date().toISOString(),
        },
      }),
    })
    .eq("id", vr.id);
  console.info("EVIDENCE_BG_JOB_PROCESSING_PERSISTED", {
    evidenceId,
    verificationRequestId: vr.id,
    processingStatus: documentaryProcessing.processing_status || documentaryProcessing.status,
    overallMatchLevel: documentaryProcessing.overall_match_level || null,
  });

  await supabase
    .from("evidences")
    .update({
      document_type: evidenceType,
      document_scope: evidenceConfig.scope,
      trust_weight: evidenceConfig.trustWeight,
      validation_status: normalizeValidationStatus(finalValidationStatus),
      inconsistency_reason: finalInconsistencyReason,
      document_issue_date: finalDocumentIssueDate,
    })
    .eq("id", evidence.id);
  console.info("EVIDENCE_BG_JOB_EVIDENCE_UPDATED", {
    evidenceId,
    validationStatus: finalValidationStatus,
    inconsistencyReason: finalInconsistencyReason,
  });

  await recalculateAndPersistCandidateTrustScore(String(evidence.uploaded_by)).catch(() => {});
  console.info("EVIDENCE_BG_JOB_TRUST_RECALCULATED", {
    evidenceId,
    candidateId: String(evidence.uploaded_by),
  });

  return {
    kind: "evidence_processing",
    id: evidenceId,
    state: documentaryProcessing.status === "failed" ? "failed" : "succeeded",
    details: documentaryProcessing.error || null,
  };
}

async function pickPendingCandidateCvJobs(limit: number) {
  const supabase = createServiceRoleClient() as any;
  const { data } = await supabase
    .from("cv_parse_jobs")
    .select("id")
    .in("status", ["queued", "failed"])
    .order("created_at", { ascending: true })
    .limit(limit);
  return (Array.isArray(data) ? data : []).map((row: any) => String(row.id)).filter(Boolean);
}

async function pickPendingCompanyImportJobs(limit: number) {
  const supabase = createServiceRoleClient() as any;
  const { data } = await supabase
    .from("company_candidate_import_invites")
    .select("id")
    .or("parse_status.eq.import_pending,parse_status.eq.parse_failed,email_delivery_status.eq.pending,email_delivery_status.eq.failed")
    .order("created_at", { ascending: true })
    .limit(limit);
  return (Array.isArray(data) ? data : []).map((row: any) => String(row.id)).filter(Boolean);
}

async function pickPendingEvidenceJobs(limit: number) {
  const supabase = createServiceRoleClient() as any;
  const { data } = await supabase
    .from("evidences")
    .select("id")
    .in("validation_status", [EVIDENCE_VALIDATION_INTERNAL.UPLOADED, EVIDENCE_VALIDATION_INTERNAL.AUTO_PROCESSING])
    .order("created_at", { ascending: true })
    .limit(limit);
  return (Array.isArray(data) ? data : []).map((row: any) => String(row.id)).filter(Boolean);
}

export async function runPendingBackgroundJobs(input: RunPendingJobsInput = {}) {
  const jobType = input.jobType || "all";
  const limit = Math.max(1, Math.min(Number(input.limit || 3), 10));
  const results: JobSummary[] = [];

  if (jobType === "candidate_cv" && input.jobId) {
    results.push(await processCandidateCvParseJob(input.jobId));
    return results;
  }
  if (jobType === "company_candidate_import" && input.jobId) {
    results.push(await processCompanyCandidateImportJob(input.jobId));
    return results;
  }
  if (jobType === "evidence_processing" && input.jobId) {
    results.push(await processEvidenceDocumentJob(input.jobId));
    return results;
  }

  if (jobType === "candidate_cv" || jobType === "all") {
    const ids = await pickPendingCandidateCvJobs(jobType === "candidate_cv" ? limit : 1);
    for (const id of ids) results.push(await processCandidateCvParseJob(id));
  }
  if (jobType === "company_candidate_import" || jobType === "all") {
    const ids = await pickPendingCompanyImportJobs(jobType === "company_candidate_import" ? limit : 1);
    for (const id of ids) results.push(await processCompanyCandidateImportJob(id));
  }
  if (jobType === "evidence_processing" || jobType === "all") {
    const ids = await pickPendingEvidenceJobs(jobType === "evidence_processing" ? limit : 1);
    for (const id of ids) results.push(await processEvidenceDocumentJob(id));
  }

  return results;
}

export function resolveInternalJobDispatchUrl(origin: string) {
  return `${origin.replace(/\/$/, "")}/api/internal/jobs/process`;
}

type DispatchBackgroundJobResult = {
  ok: boolean;
  mode: "remote" | "inline";
  status: number;
  details?: string | null;
  error?: string | null;
  results?: JobSummary[];
};

export async function dispatchBackgroundJob(params: {
  origin: string;
  jobType: "candidate_cv" | "company_candidate_import" | "evidence_processing";
  jobId: string;
}): Promise<DispatchBackgroundJobResult> {
  const internalSecret = process.env.INTERNAL_ADMIN_SECRET || "";
  const fallbackInline = async (reason: string, details?: string | null): Promise<DispatchBackgroundJobResult> => {
    console.error("BG_JOB_DISPATCH_FALLBACK_INLINE", {
      reason,
      jobType: params.jobType,
      jobId: params.jobId,
      details: details || null,
    });
    try {
      const results = await runPendingBackgroundJobs({
        jobType: params.jobType,
        jobId: params.jobId,
        limit: 1,
      });
      return {
        ok: true,
        mode: "inline",
        status: 200,
        details: details || reason,
        error: null,
        results,
      };
    } catch (error: any) {
      const message = String(error?.message || error || "inline_dispatch_failed");
      console.error("BG_JOB_DISPATCH_INLINE_FAILED", {
        reason,
        jobType: params.jobType,
        jobId: params.jobId,
        error: message,
      });
      return {
        ok: false,
        mode: "inline",
        status: 500,
        details: details || reason,
        error: message,
        results: [],
      };
    }
  };

  console.info("BG_JOB_DISPATCH_START", {
    jobType: params.jobType,
    jobId: params.jobId,
    origin: params.origin || null,
    hasInternalSecret: Boolean(internalSecret),
  });

  if (!params.origin) {
    return fallbackInline("missing_origin");
  }
  if (!internalSecret) {
    return fallbackInline("missing_internal_admin_secret");
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  headers["x-internal-secret"] = internalSecret;

  try {
    const response = await fetch(resolveInternalJobDispatchUrl(params.origin), {
      method: "POST",
      headers,
      body: JSON.stringify({
        job_type: params.jobType,
        job_id: params.jobId,
        limit: 1,
      }),
      cache: "no-store",
    });
    const responseText = await response.text();
    if (!response.ok) {
      console.error("BG_JOB_DISPATCH_REMOTE_FAILED", {
        jobType: params.jobType,
        jobId: params.jobId,
        status: response.status,
        body: responseText.slice(0, 500),
      });
      return fallbackInline(`remote_status_${response.status}`, responseText.slice(0, 500));
    }
    console.info("BG_JOB_DISPATCH_REMOTE_OK", {
      jobType: params.jobType,
      jobId: params.jobId,
      status: response.status,
      body: responseText.slice(0, 300),
    });
    return {
      ok: true,
      mode: "remote",
      status: response.status,
      details: responseText.slice(0, 300),
      error: null,
    };
  } catch (error: any) {
    console.error("BG_JOB_DISPATCH_REMOTE_ERROR", {
      jobType: params.jobType,
      jobId: params.jobId,
      error: String(error?.message || error),
    });
    return fallbackInline("remote_exception", String(error?.message || error));
  }
}

export function resolveOriginFromNodeRequest(req: { headers: Record<string, string | string[] | undefined> }) {
  const proto = normalizeText(req.headers["x-forwarded-proto"]) || "http";
  const host = normalizeText(req.headers["x-forwarded-host"]) || normalizeText(req.headers.host);
  return host ? `${proto}://${host}` : "";
}

export function buildProcessingReference(seed: string) {
  return createHash("sha256").update(seed).digest("hex").slice(0, 16);
}
