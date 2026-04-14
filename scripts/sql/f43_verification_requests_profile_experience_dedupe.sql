drop index if exists public.verification_requests_active_email_dedupe_uq;

create unique index if not exists verification_requests_active_profile_experience_dedupe_uq
  on public.verification_requests (
    requested_by,
    ((request_context ->> 'profile_experience_id'))
  )
  where verification_channel = 'email'
    and coalesce(status::text, '') <> 'revoked'
    and coalesce(status::text, '') <> 'rejected'
    and coalesce(status::text, '') <> 'expired'
    and external_resolved is not true
    and request_context is not null
    and coalesce(btrim(request_context ->> 'profile_experience_id'), '') <> '';
