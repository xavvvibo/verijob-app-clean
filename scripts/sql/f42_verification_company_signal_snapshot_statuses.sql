-- F42: allow truthful company signal snapshots on verification requests

ALTER TABLE public.verification_requests
  DROP CONSTRAINT IF EXISTS verification_requests_company_ver_status_snapshot_check;

ALTER TABLE public.verification_requests
  ADD CONSTRAINT verification_requests_company_ver_status_snapshot_check
  CHECK (
    company_verification_status_snapshot IS NULL
    OR company_verification_status_snapshot IN (
      'unverified',
      'unverified_external',
      'registered_in_verijob',
      'verified_paid',
      'verified_document'
    )
  );
