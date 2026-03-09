-- F27: Growth campaign Outscraper connector fields
alter table if exists public.growth_campaigns
  add column if not exists provider_scraping_config jsonb not null default '{}'::jsonb,
  add column if not exists provider_scraping_job_id text null,
  add column if not exists provider_scraping_last_status text null,
  add column if not exists provider_scraping_last_result jsonb not null default '{}'::jsonb,
  add column if not exists provider_scraping_last_cost numeric not null default 0,
  add column if not exists provider_scraping_last_leads integer not null default 0;
