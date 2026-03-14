create extension if not exists pgcrypto;

create table if not exists public.profile_view_consumptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  viewer_user_id uuid not null,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  verification_id uuid references public.verification_requests(id) on delete set null,
  credits_spent integer not null default 1 check (credits_spent > 0),
  source text not null default 'pack_credit' check (source in ('single_unlock', 'pack_credit', 'grant', 'promo')),
  created_at timestamptz not null default now()
);

create index if not exists profile_view_consumptions_company_created_idx
  on public.profile_view_consumptions(company_id, created_at desc);
create index if not exists profile_view_consumptions_viewer_created_idx
  on public.profile_view_consumptions(viewer_user_id, created_at desc);
create index if not exists profile_view_consumptions_candidate_created_idx
  on public.profile_view_consumptions(candidate_id, created_at desc);

create table if not exists public.stripe_oneoff_purchases (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text not null unique,
  company_id uuid not null references public.companies(id) on delete cascade,
  buyer_user_id uuid not null,
  price_id text not null,
  product_key text not null check (product_key in ('company_single_cv', 'company_pack_5')),
  amount integer not null default 0,
  currency text not null default 'eur',
  credits_granted integer not null default 0 check (credits_granted >= 0),
  created_at timestamptz not null default now()
);

create index if not exists stripe_oneoff_purchases_company_created_idx
  on public.stripe_oneoff_purchases(company_id, created_at desc);
create index if not exists stripe_oneoff_purchases_buyer_created_idx
  on public.stripe_oneoff_purchases(buyer_user_id, created_at desc);
create index if not exists stripe_oneoff_purchases_product_created_idx
  on public.stripe_oneoff_purchases(product_key, created_at desc);
create unique index if not exists credit_grants_oneoff_source_unique
  on public.credit_grants(source_type, source_id)
  where source_type = 'stripe_oneoff_purchase' and source_id is not null;

alter table public.profile_view_consumptions enable row level security;
alter table public.stripe_oneoff_purchases enable row level security;

alter table public.profile_view_consumptions force row level security;
alter table public.stripe_oneoff_purchases force row level security;

revoke all on table public.profile_view_consumptions from anon, authenticated;
revoke all on table public.stripe_oneoff_purchases from anon, authenticated;

drop policy if exists profile_view_consumptions_deny_all on public.profile_view_consumptions;
create policy profile_view_consumptions_deny_all on public.profile_view_consumptions
  for all to anon, authenticated
  using (false)
  with check (false);

drop policy if exists stripe_oneoff_purchases_deny_all on public.stripe_oneoff_purchases;
create policy stripe_oneoff_purchases_deny_all on public.stripe_oneoff_purchases
  for all to anon, authenticated
  using (false)
  with check (false);

create or replace view public.owner_monetization_summary as
with
  consumption as (
    select
      count(*)::bigint as total_unlocks,
      coalesce(sum(credits_spent), 0)::bigint as total_credits_consumed,
      count(distinct company_id)::bigint as companies_consuming_credits
    from public.profile_view_consumptions
  ),
  purchases as (
    select
      coalesce(sum(amount), 0)::bigint as total_oneoff_revenue,
      count(*) filter (where product_key = 'company_pack_5')::bigint as total_pack_sales,
      count(*) filter (where product_key = 'company_single_cv')::bigint as total_single_unlock_sales,
      count(*)::bigint as total_oneoff_purchases,
      coalesce(sum(credits_granted), 0)::bigint as total_oneoff_credits_granted,
      max(created_at) as last_oneoff_purchase_at
    from public.stripe_oneoff_purchases
  ),
  grants as (
    select
      coalesce(sum(credits), 0)::bigint as total_credits_granted
    from public.credit_grants
    where coalesce(is_active, true) = true
  ),
  promos as (
    select
      count(*)::bigint as total_promo_redemptions
    from public.promo_code_redemptions
  ),
  manuals as (
    select
      count(*)::bigint as total_manual_grants
    from public.manual_grants
  ),
  recurring as (
    select
      0::bigint as recurring_revenue_cents,
      count(*) filter (where lower(coalesce(status, '')) in ('active', 'trialing'))::bigint as active_subscriptions
    from public.subscriptions
  )
select
  consumption.total_unlocks,
  consumption.total_credits_consumed,
  purchases.total_oneoff_revenue,
  purchases.total_pack_sales,
  purchases.total_single_unlock_sales,
  greatest(grants.total_credits_granted - consumption.total_credits_consumed, 0)::bigint as credits_remaining_global,
  consumption.companies_consuming_credits,
  grants.total_credits_granted,
  purchases.total_oneoff_purchases,
  purchases.total_oneoff_credits_granted,
  purchases.last_oneoff_purchase_at,
  promos.total_promo_redemptions,
  manuals.total_manual_grants,
  recurring.recurring_revenue_cents,
  recurring.active_subscriptions
from consumption, purchases, grants, promos, manuals, recurring;
