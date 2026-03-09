-- F25: Growth campaign execution layer

alter table public.growth_campaigns
  add column if not exists execution_status text not null default 'idle',
  add column if not exists provider_scraping text,
  add column if not exists provider_enrichment text,
  add column if not exists provider_sending text,
  add column if not exists external_job_id text,
  add column if not exists last_sync_at timestamptz,
  add column if not exists execution_started_at timestamptz,
  add column if not exists execution_finished_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'growth_campaigns_execution_status_check'
  ) then
    alter table public.growth_campaigns
      add constraint growth_campaigns_execution_status_check
      check (execution_status in ('idle','queued','running','paused','completed','failed'));
  end if;
end $$;
