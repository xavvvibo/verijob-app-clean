-- f41_candidate_lifecycle_delete_alignment.sql
-- Reassert candidate lifecycle columns used by owner delete flows.

alter table public.profiles
  add column if not exists lifecycle_status text default 'active' not null,
  add column if not exists deleted_at timestamptz null,
  add column if not exists deleted_by uuid null,
  add column if not exists deletion_reason text null;

update public.profiles
set lifecycle_status = 'active'
where lifecycle_status is null;

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

create index if not exists profiles_lifecycle_status_idx
  on public.profiles(lifecycle_status);

