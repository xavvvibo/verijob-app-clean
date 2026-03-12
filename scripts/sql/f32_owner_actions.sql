-- f32_owner_actions.sql
-- Trazabilidad mínima para acciones owner/admin sobre usuarios.

create table if not exists public.owner_actions (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null,
  owner_user_id uuid not null,
  action_type text not null,
  reason text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists owner_actions_target_user_idx on public.owner_actions(target_user_id, created_at desc);
create index if not exists owner_actions_owner_user_idx on public.owner_actions(owner_user_id, created_at desc);
create index if not exists owner_actions_action_type_idx on public.owner_actions(action_type);

alter table public.owner_actions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'owner_actions'
      and policyname = 'owner_actions_owner_read'
  ) then
    create policy owner_actions_owner_read
      on public.owner_actions
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and lower(coalesce(p.role, '')) in ('owner','admin')
        )
      );
  end if;
end $$;
