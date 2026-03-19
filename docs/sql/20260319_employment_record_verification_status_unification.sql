begin;

update public.employment_records
set verification_status = case
  when verification_status is null or btrim(verification_status) = '' then 'unverified'
  when lower(verification_status) in ('unverified', 'not_requested', 'revoked') then 'unverified'
  when lower(verification_status) in (
    'verification_requested',
    'pending_company',
    'reviewing',
    'requested',
    'company_registered_pending',
    'in_review'
  ) then 'verification_requested'
  when lower(verification_status) in (
    'verified',
    'approved',
    'verified_document',
    'verified_paid'
  ) then 'verified'
  when lower(verification_status) = 'rejected' then 'rejected'
  else 'unverified'
end;

alter table public.employment_records
  alter column verification_status set default 'unverified';

alter table public.employment_records
  alter column verification_status set not null;

alter table public.employment_records
  drop constraint if exists employment_records_verification_status_check;

alter table public.employment_records
  add constraint employment_records_verification_status_check
  check (
    verification_status in (
      'unverified',
      'verification_requested',
      'verified',
      'rejected'
    )
  );

commit;
