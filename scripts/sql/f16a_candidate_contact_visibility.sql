-- F16a: Contact visibility controls for candidate_profiles
ALTER TABLE public.candidate_profiles
  ADD COLUMN IF NOT EXISTS allow_company_email_contact boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_company_phone_contact boolean NOT NULL DEFAULT false;
