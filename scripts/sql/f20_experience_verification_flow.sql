-- F20: Verification-by-experience flow hardening

ALTER TABLE public.employment_records
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS last_verification_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_result text,
  ADD COLUMN IF NOT EXISTS company_verification_status_snapshot text,
  ADD COLUMN IF NOT EXISTS verified_by_company_id uuid,
  ADD COLUMN IF NOT EXISTS last_verification_request_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employment_records_verification_status_check'
  ) THEN
    ALTER TABLE public.employment_records
      ADD CONSTRAINT employment_records_verification_status_check
      CHECK (verification_status IN ('not_requested','requested','company_registered_pending','verified','rejected','expired'));
  END IF;
END
$$;

ALTER TABLE public.verification_requests
  ADD COLUMN IF NOT EXISTS company_email_target text,
  ADD COLUMN IF NOT EXISTS company_name_target text,
  ADD COLUMN IF NOT EXISTS verification_channel text,
  ADD COLUMN IF NOT EXISTS requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolution_notes text,
  ADD COLUMN IF NOT EXISTS company_id_snapshot uuid,
  ADD COLUMN IF NOT EXISTS company_name_snapshot text,
  ADD COLUMN IF NOT EXISTS company_verification_status_snapshot text,
  ADD COLUMN IF NOT EXISTS snapshot_at timestamptz,
  ADD COLUMN IF NOT EXISTS request_context jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'verification_requests_company_ver_status_snapshot_check'
  ) THEN
    ALTER TABLE public.verification_requests
      ADD CONSTRAINT verification_requests_company_ver_status_snapshot_check
      CHECK (
        company_verification_status_snapshot IS NULL
        OR company_verification_status_snapshot IN ('unverified','verified_document','verified_paid')
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_employment_records_candidate_ver_status
  ON public.employment_records (candidate_id, verification_status);

CREATE INDEX IF NOT EXISTS idx_verification_requests_requested_at
  ON public.verification_requests (requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_verification_requests_company_email_target
  ON public.verification_requests (company_email_target);
