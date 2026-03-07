-- F17a: Candidate availability fields (progressive profile completion)
ALTER TABLE public.candidate_profiles
  ADD COLUMN IF NOT EXISTS job_search_status text,
  ADD COLUMN IF NOT EXISTS availability_start text,
  ADD COLUMN IF NOT EXISTS preferred_workday text,
  ADD COLUMN IF NOT EXISTS preferred_roles text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS work_zones text,
  ADD COLUMN IF NOT EXISTS availability_schedule text[] NOT NULL DEFAULT '{}';
