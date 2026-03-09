-- F26: Growth campaign provider sync layer

alter table public.growth_campaigns
  add column if not exists last_provider_payload jsonb not null default '{}'::jsonb,
  add column if not exists last_provider_error text,
  add column if not exists sync_attempts int not null default 0,
  add column if not exists next_sync_at timestamptz;
