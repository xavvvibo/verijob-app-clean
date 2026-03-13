-- f36_company_candidate_cv_import_flow.sql
-- Flujo empresa -> candidato por subida de CV + aceptación legal trazable.

create table if not exists public.company_candidate_import_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  invited_by_user_id uuid null references public.profiles(id) on delete set null,
  accepted_by_user_id uuid null references public.profiles(id) on delete set null,
  linked_user_id uuid null references public.profiles(id) on delete set null,
  candidate_email text not null,
  candidate_name_raw text,
  target_role text,
  source text not null default 'company_cv_upload',
  source_notes text,
  storage_bucket text not null default 'candidate-cv',
  storage_path text not null,
  original_filename text,
  mime_type text,
  size_bytes bigint,
  cv_sha256 text,
  parse_status text not null default 'import_pending',
  extracted_payload_json jsonb,
  extracted_warnings jsonb not null default '[]'::jsonb,
  invite_token text not null unique,
  status text not null default 'uploaded',
  email_delivery_status text,
  emailed_at timestamptz,
  accepted_at timestamptz,
  accepted_ip text,
  accepted_user_agent text,
  legal_text_version text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'company_candidate_import_invites_parse_status_check'
  ) then
    alter table public.company_candidate_import_invites
      add constraint company_candidate_import_invites_parse_status_check
      check (parse_status in ('import_pending', 'processing', 'parsed_ready', 'parse_failed'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'company_candidate_import_invites_status_check'
  ) then
    alter table public.company_candidate_import_invites
      add constraint company_candidate_import_invites_status_check
      check (status in ('uploaded', 'emailed', 'accepted', 'converted', 'expired', 'rejected'));
  end if;
end $$;

create index if not exists idx_company_candidate_import_invites_company_created
  on public.company_candidate_import_invites(company_id, created_at desc);

create index if not exists idx_company_candidate_import_invites_email
  on public.company_candidate_import_invites(lower(candidate_email));

create index if not exists idx_company_candidate_import_invites_token
  on public.company_candidate_import_invites(invite_token);

create table if not exists public.company_candidate_import_acceptances (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.company_candidate_import_invites(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  candidate_email text not null,
  accepted_by_user_id uuid null references public.profiles(id) on delete set null,
  source_flow text not null default 'company_cv_import',
  legal_text_version text not null,
  legal_snapshot_json jsonb not null,
  accepted_at timestamptz not null default now(),
  accepted_ip text,
  accepted_user_agent text,
  cv_sha256 text,
  created_at timestamptz not null default now()
);

create index if not exists idx_company_candidate_import_acceptances_invite
  on public.company_candidate_import_acceptances(invite_id, created_at desc);
