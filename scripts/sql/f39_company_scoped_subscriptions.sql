alter table public.subscriptions
  add column if not exists company_id uuid references public.companies(id) on delete set null;

create index if not exists idx_subscriptions_company_id
  on public.subscriptions(company_id);

update public.subscriptions s
set company_id = p.active_company_id
from public.profiles p
where s.user_id = p.id
  and s.company_id is null
  and p.active_company_id is not null
  and lower(coalesce(s.plan, '')) like 'company_%';

with ranked as (
  select
    id,
    company_id,
    row_number() over (
      partition by company_id
      order by coalesce(updated_at, created_at) desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from public.subscriptions
  where company_id is not null
)
update public.subscriptions s
set company_id = null,
    metadata = coalesce(s.metadata, '{}'::jsonb) || jsonb_build_object(
      'company_scope_migration',
      jsonb_build_object(
        'detached_at', now(),
        'reason', 'duplicate_company_subscription_row_preserved_as_legacy'
      )
    )
from ranked r
where s.id = r.id
  and r.rn > 1;

create unique index if not exists uq_subscriptions_company_id
  on public.subscriptions(company_id);
