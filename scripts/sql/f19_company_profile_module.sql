-- F19: Company profile module (MVP)
-- Reuses public.company_profiles as canonical store.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'company_profiles'
  ) THEN
    CREATE TABLE public.company_profiles (
      company_id uuid PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END
$$;

ALTER TABLE public.company_profiles
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS trade_name text,
  ADD COLUMN IF NOT EXISTS tax_id text,
  ADD COLUMN IF NOT EXISTS company_type text,
  ADD COLUMN IF NOT EXISTS founding_year integer,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_person_name text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS fiscal_address text,
  ADD COLUMN IF NOT EXISTS operating_address text,
  ADD COLUMN IF NOT EXISTS sector text,
  ADD COLUMN IF NOT EXISTS subsector text,
  ADD COLUMN IF NOT EXISTS business_description text,
  ADD COLUMN IF NOT EXISTS primary_activity text,
  ADD COLUMN IF NOT EXISTS business_model text,
  ADD COLUMN IF NOT EXISTS seasonal_business boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS employee_count_range text,
  ADD COLUMN IF NOT EXISTS locations_count integer,
  ADD COLUMN IF NOT EXISTS annual_hiring_volume_range text,
  ADD COLUMN IF NOT EXISTS has_internal_hr boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS common_roles_hired text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS common_contract_types text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS common_workday_types text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS common_languages_required text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hiring_zones text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS company_verification_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_document_type text,
  ADD COLUMN IF NOT EXISTS verification_document_storage_path text,
  ADD COLUMN IF NOT EXISTS verification_document_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_notes text,
  ADD COLUMN IF NOT EXISTS lead_source text,
  ADD COLUMN IF NOT EXISTS crm_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS market_segment text,
  ADD COLUMN IF NOT EXISTS profile_completeness_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_profiles_company_verification_status_check'
  ) THEN
    ALTER TABLE public.company_profiles
      ADD CONSTRAINT company_profiles_company_verification_status_check
      CHECK (company_verification_status IN ('unverified', 'verified_document', 'verified_paid'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_company_profiles_sector ON public.company_profiles (sector);
CREATE INDEX IF NOT EXISTS idx_company_profiles_subsector ON public.company_profiles (subsector);
CREATE INDEX IF NOT EXISTS idx_company_profiles_city ON public.company_profiles (city);
CREATE INDEX IF NOT EXISTS idx_company_profiles_province ON public.company_profiles (province);
CREATE INDEX IF NOT EXISTS idx_company_profiles_employee_count_range ON public.company_profiles (employee_count_range);
CREATE INDEX IF NOT EXISTS idx_company_profiles_annual_hiring_volume_range ON public.company_profiles (annual_hiring_volume_range);
CREATE INDEX IF NOT EXISTS idx_company_profiles_market_segment ON public.company_profiles (market_segment);
CREATE INDEX IF NOT EXISTS idx_company_profiles_verification_status ON public.company_profiles (company_verification_status);
CREATE INDEX IF NOT EXISTS idx_company_profiles_completeness ON public.company_profiles (profile_completeness_score);
