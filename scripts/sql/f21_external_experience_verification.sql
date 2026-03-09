-- F21: External experience verification flow (company not registered)

alter table if exists public.verification_requests
  add column if not exists external_token text,
  add column if not exists external_email_target text,
  add column if not exists external_token_expires_at timestamptz,
  add column if not exists external_resolved boolean not null default false;

create unique index if not exists verification_requests_external_token_uq
  on public.verification_requests (external_token)
  where external_token is not null;

create index if not exists verification_requests_external_token_expires_idx
  on public.verification_requests (external_token_expires_at)
  where external_token_expires_at is not null;

create index if not exists verification_requests_external_email_target_idx
  on public.verification_requests (external_email_target)
  where external_email_target is not null;
