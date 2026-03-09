-- F18: Company verification status (unverified / verified_document / verified_paid)
-- Applies to whichever canonical company table exists in this project state.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'companies'
  ) THEN
    ALTER TABLE public.companies
      ADD COLUMN IF NOT EXISTS company_verification_status text NOT NULL DEFAULT 'unverified';

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'companies_company_verification_status_check'
    ) THEN
      ALTER TABLE public.companies
        ADD CONSTRAINT companies_company_verification_status_check
        CHECK (company_verification_status IN ('unverified', 'verified_document', 'verified_paid'));
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'company_profiles'
  ) THEN
    ALTER TABLE public.company_profiles
      ADD COLUMN IF NOT EXISTS company_verification_status text NOT NULL DEFAULT 'unverified';

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'company_profiles_company_verification_status_check'
    ) THEN
      ALTER TABLE public.company_profiles
        ADD CONSTRAINT company_profiles_company_verification_status_check
        CHECK (company_verification_status IN ('unverified', 'verified_document', 'verified_paid'));
    END IF;
  END IF;
END
$$;
