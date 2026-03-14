create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_mode text,
  add column if not exists identity_type text,
  add column if not exists identity_masked text,
  add column if not exists identity_hash text;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'profiles_lifecycle_status_check'
  ) then
    alter table public.profiles drop constraint profiles_lifecycle_status_check;
  end if;
end $$;

alter table public.profiles
  add constraint profiles_lifecycle_status_check
  check (lifecycle_status in ('active', 'disabled', 'scheduled_for_deletion', 'deleted'));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_deletion_mode_check'
  ) then
    alter table public.profiles
      add constraint profiles_deletion_mode_check
      check (deletion_mode is null or deletion_mode in ('temporary', 'permanent'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_identity_type_check'
  ) then
    alter table public.profiles
      add constraint profiles_identity_type_check
      check (identity_type is null or identity_type in ('dni', 'nif', 'passport'));
  end if;
end $$;

create index if not exists profiles_identity_hash_idx
  on public.profiles(identity_hash);

alter table public.companies
  add column if not exists lifecycle_status text not null default 'active',
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists identity_type text,
  add column if not exists identity_masked text,
  add column if not exists identity_hash text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'companies_lifecycle_status_check'
  ) then
    alter table public.companies
      add constraint companies_lifecycle_status_check
      check (lifecycle_status in ('active', 'disabled', 'scheduled_for_deletion', 'deleted'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'companies_identity_type_check'
  ) then
    alter table public.companies
      add constraint companies_identity_type_check
      check (identity_type is null or identity_type in ('nif', 'passport'));
  end if;
end $$;

create index if not exists companies_lifecycle_status_idx
  on public.companies(lifecycle_status);

create index if not exists companies_identity_hash_idx
  on public.companies(identity_hash);

