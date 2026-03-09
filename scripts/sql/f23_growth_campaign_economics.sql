-- F23: Growth campaign economics

alter table public.growth_campaigns
  add column if not exists cost_scraping numeric(12,2) not null default 0,
  add column if not exists cost_enrichment numeric(12,2) not null default 0,
  add column if not exists cost_sending numeric(12,2) not null default 0,
  add column if not exists cost_infra numeric(12,2) not null default 0,
  add column if not exists customers_converted int not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'growth_campaigns_customers_converted_non_negative'
  ) then
    alter table public.growth_campaigns
      add constraint growth_campaigns_customers_converted_non_negative
      check (customers_converted >= 0);
  end if;
end $$;

create index if not exists growth_campaigns_created_status_idx
  on public.growth_campaigns(created_at desc, status);
