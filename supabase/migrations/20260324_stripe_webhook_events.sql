create table if not exists public.stripe_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  livemode boolean not null default false,
  status text not null default 'processing' check (status in ('processing', 'processed', 'failed')),
  object_id text null,
  api_version text null,
  attempts integer not null default 1,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz null,
  last_error text null,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_stripe_webhook_events_status
  on public.stripe_webhook_events(status, last_seen_at desc);

create index if not exists idx_stripe_webhook_events_object
  on public.stripe_webhook_events(object_id, last_seen_at desc);
