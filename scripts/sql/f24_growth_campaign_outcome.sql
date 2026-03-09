-- F24: Growth campaign outcome note

alter table public.growth_campaigns
  add column if not exists outcome_note text;
