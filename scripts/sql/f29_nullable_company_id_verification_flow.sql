-- Allow email verification requests for companies not yet registered in VERIJOB.
-- company_id must be nullable in both records linked to the request flow.

ALTER TABLE IF EXISTS public.employment_records
  ALTER COLUMN company_id DROP NOT NULL;

ALTER TABLE IF EXISTS public.verification_requests
  ALTER COLUMN company_id DROP NOT NULL;
