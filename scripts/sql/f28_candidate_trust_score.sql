-- F28: Candidate Trust Score MVP column hardening
ALTER TABLE public.candidate_profiles
  ADD COLUMN IF NOT EXISTS trust_score numeric;
