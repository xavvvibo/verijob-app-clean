-- f35_company_team_invitations.sql
-- Invitaciones minimas de equipo empresa para lanzamiento.

create table if not exists public.company_team_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  role text not null default 'reviewer',
  status text not null default 'pending',
  invited_by uuid null references public.profiles(id) on delete set null,
  invite_token text not null unique,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'company_team_invitations_role_check'
  ) then
    alter table public.company_team_invitations
      add constraint company_team_invitations_role_check
      check (role in ('admin', 'reviewer'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'company_team_invitations_status_check'
  ) then
    alter table public.company_team_invitations
      add constraint company_team_invitations_status_check
      check (status in ('pending', 'accepted', 'cancelled', 'expired'));
  end if;
end $$;

create unique index if not exists company_team_invitations_pending_email_uq
  on public.company_team_invitations (company_id, lower(email))
  where status = 'pending';

create index if not exists idx_company_team_invitations_company_created
  on public.company_team_invitations (company_id, created_at desc);
