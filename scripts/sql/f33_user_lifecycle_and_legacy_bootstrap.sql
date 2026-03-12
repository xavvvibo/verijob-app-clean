-- f33_user_lifecycle_and_legacy_bootstrap.sql
-- Soft-delete lifecycle for users + diagnostics for legacy company bootstrap issues.

alter table public.profiles
  add column if not exists lifecycle_status text not null default 'active',
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid,
  add column if not exists deletion_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_lifecycle_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_lifecycle_status_check
      check (lifecycle_status in ('active', 'disabled', 'deleted'));
  end if;
end $$;

create index if not exists profiles_lifecycle_status_idx
  on public.profiles(lifecycle_status);

create index if not exists profiles_deleted_at_idx
  on public.profiles(deleted_at desc);

-- Backfill defensive values for old rows.
update public.profiles
set lifecycle_status = 'active'
where lifecycle_status is null;

-- Optional diagnostic query for owner/admin:
-- Find users with role company and broken context (missing active company or missing membership/profile).
-- select
--   p.id as user_id,
--   p.email,
--   p.role,
--   p.active_company_id,
--   cm.company_id as membership_company_id,
--   cp.company_id as company_profile_id
-- from public.profiles p
-- left join public.company_members cm
--   on cm.user_id = p.id
--   and (p.active_company_id is null or cm.company_id = p.active_company_id)
-- left join public.company_profiles cp
--   on cp.company_id = coalesce(p.active_company_id, cm.company_id)
-- where lower(coalesce(p.role, '')) = 'company'
--   and (
--     p.active_company_id is null
--     or cm.company_id is null
--     or cp.company_id is null
--   )
-- order by p.created_at desc nulls last;
