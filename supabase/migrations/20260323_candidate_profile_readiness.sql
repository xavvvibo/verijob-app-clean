alter table public.candidate_profiles
add column if not exists profile_ready_for_company_access boolean not null default false;

alter table public.candidate_profiles
add column if not exists profile_ready_reason text;

alter table public.candidate_profiles
add column if not exists profile_ready_updated_at timestamptz;

update public.candidate_profiles cp
set
  profile_ready_for_company_access = exists (
    select 1
    from public.employment_records er
    where er.candidate_id = cp.user_id
      and er.verification_status = 'verified'
  ),
  profile_ready_reason = case
    when exists (
      select 1
      from public.employment_records er
      where er.candidate_id = cp.user_id
        and er.verification_status = 'verified'
    ) then 'ready'
    when exists (
      select 1
      from public.employment_records er
      where er.candidate_id = cp.user_id
    ) then 'verification_pending'
    else 'missing_experience'
  end,
  profile_ready_updated_at = now();
