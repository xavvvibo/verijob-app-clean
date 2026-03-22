create or replace function public.set_candidate_collection_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.candidate_education (
  id uuid primary key default gen_random_uuid()
);

create table if not exists public.candidate_languages (
  id uuid primary key default gen_random_uuid()
);

create table if not exists public.candidate_certifications (
  id uuid primary key default gen_random_uuid()
);

create table if not exists public.candidate_achievements (
  id uuid primary key default gen_random_uuid()
);

alter table public.candidate_education
  add column if not exists user_id uuid,
  add column if not exists candidate_id uuid,
  add column if not exists candidate_profile_id uuid,
  add column if not exists institution_name text,
  add column if not exists degree_name text,
  add column if not exists field_of_study text,
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists is_current boolean not null default false,
  add column if not exists description text,
  add column if not exists source text not null default 'manual',
  add column if not exists display_order integer not null default 0,
  add column if not exists is_visible boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.candidate_languages
  add column if not exists user_id uuid,
  add column if not exists candidate_id uuid,
  add column if not exists candidate_profile_id uuid,
  add column if not exists language_name text,
  add column if not exists proficiency_level text,
  add column if not exists is_native boolean not null default false,
  add column if not exists notes text,
  add column if not exists source text not null default 'manual',
  add column if not exists display_order integer not null default 0,
  add column if not exists is_visible boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.candidate_certifications
  add column if not exists user_id uuid,
  add column if not exists candidate_id uuid,
  add column if not exists candidate_profile_id uuid,
  add column if not exists name text,
  add column if not exists issuer text,
  add column if not exists issue_date date,
  add column if not exists expiry_date date,
  add column if not exists credential_id text,
  add column if not exists credential_url text,
  add column if not exists notes text,
  add column if not exists source text not null default 'manual',
  add column if not exists display_order integer not null default 0,
  add column if not exists is_visible boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.candidate_achievements
  add column if not exists user_id uuid,
  add column if not exists candidate_id uuid,
  add column if not exists candidate_profile_id uuid,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists achievement_type text,
  add column if not exists issuer text,
  add column if not exists achieved_at date,
  add column if not exists source text not null default 'manual',
  add column if not exists display_order integer not null default 0,
  add column if not exists is_visible boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.candidate_education
set institution_name = coalesce(institution_name, ''),
    degree_name = coalesce(degree_name, 'Formación'),
    user_id = coalesce(user_id, candidate_id),
    candidate_id = coalesce(candidate_id, user_id)
where institution_name is null or degree_name is null or user_id is null or candidate_id is null;

update public.candidate_languages
set language_name = coalesce(language_name, 'Idioma pendiente'),
    user_id = coalesce(user_id, candidate_id),
    candidate_id = coalesce(candidate_id, user_id)
where language_name is null or user_id is null or candidate_id is null;

update public.candidate_certifications
set name = coalesce(name, 'Certificación'),
    user_id = coalesce(user_id, candidate_id),
    candidate_id = coalesce(candidate_id, user_id)
where name is null or user_id is null or candidate_id is null;

update public.candidate_achievements
set title = coalesce(title, 'Logro'),
    user_id = coalesce(user_id, candidate_id),
    candidate_id = coalesce(candidate_id, user_id)
where title is null or user_id is null or candidate_id is null;

alter table public.candidate_education
  alter column user_id set not null,
  alter column candidate_id set not null,
  alter column institution_name set not null,
  alter column degree_name set not null;

alter table public.candidate_languages
  alter column user_id set not null,
  alter column candidate_id set not null,
  alter column language_name set not null;

alter table public.candidate_certifications
  alter column user_id set not null,
  alter column candidate_id set not null,
  alter column name set not null;

alter table public.candidate_achievements
  alter column user_id set not null,
  alter column candidate_id set not null,
  alter column title set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'candidate_education_user_id_fkey'
  ) then
    alter table public.candidate_education
      add constraint candidate_education_user_id_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'candidate_education_candidate_id_fkey'
  ) then
    alter table public.candidate_education
      add constraint candidate_education_candidate_id_fkey
      foreign key (candidate_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'candidate_languages_user_id_fkey'
  ) then
    alter table public.candidate_languages
      add constraint candidate_languages_user_id_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'candidate_languages_candidate_id_fkey'
  ) then
    alter table public.candidate_languages
      add constraint candidate_languages_candidate_id_fkey
      foreign key (candidate_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'candidate_certifications_user_id_fkey'
  ) then
    alter table public.candidate_certifications
      add constraint candidate_certifications_user_id_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'candidate_certifications_candidate_id_fkey'
  ) then
    alter table public.candidate_certifications
      add constraint candidate_certifications_candidate_id_fkey
      foreign key (candidate_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'candidate_achievements_user_id_fkey'
  ) then
    alter table public.candidate_achievements
      add constraint candidate_achievements_user_id_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'candidate_achievements_candidate_id_fkey'
  ) then
    alter table public.candidate_achievements
      add constraint candidate_achievements_candidate_id_fkey
      foreign key (candidate_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'candidate_profiles'
      and column_name = 'id'
  ) and not exists (
    select 1 from pg_constraint where conname = 'candidate_education_candidate_profile_id_fkey'
  ) then
    alter table public.candidate_education
      add constraint candidate_education_candidate_profile_id_fkey
      foreign key (candidate_profile_id) references public.candidate_profiles(id) on delete set null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'candidate_profiles'
      and column_name = 'id'
  ) and not exists (
    select 1 from pg_constraint where conname = 'candidate_languages_candidate_profile_id_fkey'
  ) then
    alter table public.candidate_languages
      add constraint candidate_languages_candidate_profile_id_fkey
      foreign key (candidate_profile_id) references public.candidate_profiles(id) on delete set null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'candidate_profiles'
      and column_name = 'id'
  ) and not exists (
    select 1 from pg_constraint where conname = 'candidate_certifications_candidate_profile_id_fkey'
  ) then
    alter table public.candidate_certifications
      add constraint candidate_certifications_candidate_profile_id_fkey
      foreign key (candidate_profile_id) references public.candidate_profiles(id) on delete set null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'candidate_profiles'
      and column_name = 'id'
  ) and not exists (
    select 1 from pg_constraint where conname = 'candidate_achievements_candidate_profile_id_fkey'
  ) then
    alter table public.candidate_achievements
      add constraint candidate_achievements_candidate_profile_id_fkey
      foreign key (candidate_profile_id) references public.candidate_profiles(id) on delete set null;
  end if;
end $$;

create index if not exists idx_candidate_education_user_order
  on public.candidate_education(user_id, display_order, created_at);

create index if not exists idx_candidate_languages_user_order
  on public.candidate_languages(user_id, display_order, created_at);

create index if not exists idx_candidate_certifications_user_order
  on public.candidate_certifications(user_id, display_order, created_at);

create index if not exists idx_candidate_achievements_user_order
  on public.candidate_achievements(user_id, display_order, created_at);

drop trigger if exists trg_candidate_education_updated_at on public.candidate_education;
create trigger trg_candidate_education_updated_at
before update on public.candidate_education
for each row execute function public.set_candidate_collection_updated_at();

drop trigger if exists trg_candidate_languages_updated_at on public.candidate_languages;
create trigger trg_candidate_languages_updated_at
before update on public.candidate_languages
for each row execute function public.set_candidate_collection_updated_at();

drop trigger if exists trg_candidate_certifications_updated_at on public.candidate_certifications;
create trigger trg_candidate_certifications_updated_at
before update on public.candidate_certifications
for each row execute function public.set_candidate_collection_updated_at();

drop trigger if exists trg_candidate_achievements_updated_at on public.candidate_achievements;
create trigger trg_candidate_achievements_updated_at
before update on public.candidate_achievements
for each row execute function public.set_candidate_collection_updated_at();

alter table public.candidate_education enable row level security;
alter table public.candidate_languages enable row level security;
alter table public.candidate_certifications enable row level security;
alter table public.candidate_achievements enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'candidate_education' and policyname = 'candidate_education_self_all'
  ) then
    create policy candidate_education_self_all
      on public.candidate_education
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'candidate_languages' and policyname = 'candidate_languages_self_all'
  ) then
    create policy candidate_languages_self_all
      on public.candidate_languages
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'candidate_certifications' and policyname = 'candidate_certifications_self_all'
  ) then
    create policy candidate_certifications_self_all
      on public.candidate_certifications
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'candidate_achievements' and policyname = 'candidate_achievements_self_all'
  ) then
    create policy candidate_achievements_self_all
      on public.candidate_achievements
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'candidate_education' and policyname = 'candidate_education_service_role_all'
  ) then
    create policy candidate_education_service_role_all
      on public.candidate_education
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'candidate_languages' and policyname = 'candidate_languages_service_role_all'
  ) then
    create policy candidate_languages_service_role_all
      on public.candidate_languages
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'candidate_certifications' and policyname = 'candidate_certifications_service_role_all'
  ) then
    create policy candidate_certifications_service_role_all
      on public.candidate_certifications
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'candidate_achievements' and policyname = 'candidate_achievements_service_role_all'
  ) then
    create policy candidate_achievements_service_role_all
      on public.candidate_achievements
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

do $$
declare
  education_insert_columns text := '';
  education_select_columns text := '';
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'candidate_profiles'
      and column_name = 'education'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'candidate_profiles'
      and column_name = 'user_id'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'candidate_profiles'
      and column_name = 'id'
  ) then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'candidate_education'
        and column_name = 'user_id'
    ) then
      education_insert_columns := education_insert_columns || 'user_id, ';
      education_select_columns := education_select_columns || 'cp.user_id, ';
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'candidate_education'
        and column_name = 'candidate_id'
    ) then
      education_insert_columns := education_insert_columns || 'candidate_id, ';
      education_select_columns := education_select_columns || 'cp.user_id, ';
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'candidate_education'
        and column_name = 'candidate_profile_id'
    ) then
      education_insert_columns := education_insert_columns || 'candidate_profile_id, ';
      education_select_columns := education_select_columns || 'cp.id, ';
    end if;

    education_insert_columns := education_insert_columns || 'institution_name, degree_name, start_date, end_date, is_current, description, source, display_order, is_visible';
    education_select_columns := education_select_columns || $sql$
      coalesce(trim(item->>'institution'), ''),
      coalesce(trim(item->>'title'), trim(item->>'degree'), 'Formación'),
      case
        when coalesce(item->>'start_date', item->>'start', '') ~ '^\d{4}-\d{2}-\d{2}$' then (item->>'start_date')::date
        when coalesce(item->>'start_date', item->>'start', '') ~ '^\d{4}-\d{2}$' then ((coalesce(item->>'start_date', item->>'start')) || '-01')::date
        when coalesce(item->>'start_date', item->>'start', '') ~ '^\d{4}$' then ((coalesce(item->>'start_date', item->>'start')) || '-01-01')::date
        else null
      end,
      case
        when coalesce(item->>'end_date', item->>'end', '') ~ '^\d{4}-\d{2}-\d{2}$' then (item->>'end_date')::date
        when coalesce(item->>'end_date', item->>'end', '') ~ '^\d{4}-\d{2}$' then ((coalesce(item->>'end_date', item->>'end')) || '-01')::date
        when coalesce(item->>'end_date', item->>'end', '') ~ '^\d{4}$' then ((coalesce(item->>'end_date', item->>'end')) || '-01-01')::date
        else null
      end,
      coalesce((item->>'in_progress')::boolean, false),
      nullif(trim(coalesce(item->>'description', item->>'notes', '')), ''),
      'legacy',
      ordinality - 1,
      true
    $sql$;

    execute format(
      $sql$
      insert into public.candidate_education (%s)
      select %s
      from public.candidate_profiles cp
      cross join lateral jsonb_array_elements(coalesce(cp.education, '[]'::jsonb)) with ordinality as items(item, ordinality)
      where not exists (
        select 1
        from public.candidate_education ce
        where ce.user_id = cp.user_id
      )
      $sql$,
      education_insert_columns,
      education_select_columns
    );
  end if;
end $$;

do $$
declare
  certification_insert_columns text := '';
  certification_select_columns text := '';
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'candidate_profiles'
      and column_name = 'certifications'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'candidate_profiles'
      and column_name = 'user_id'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'candidate_profiles'
      and column_name = 'id'
  ) then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'candidate_certifications'
        and column_name = 'user_id'
    ) then
      certification_insert_columns := certification_insert_columns || 'user_id, ';
      certification_select_columns := certification_select_columns || 'cp.user_id, ';
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'candidate_certifications'
        and column_name = 'candidate_id'
    ) then
      certification_insert_columns := certification_insert_columns || 'candidate_id, ';
      certification_select_columns := certification_select_columns || 'cp.user_id, ';
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'candidate_certifications'
        and column_name = 'candidate_profile_id'
    ) then
      certification_insert_columns := certification_insert_columns || 'candidate_profile_id, ';
      certification_select_columns := certification_select_columns || 'cp.id, ';
    end if;

    certification_insert_columns := certification_insert_columns || 'name, issuer, issue_date, credential_id, notes, source, display_order, is_visible';
    certification_select_columns := certification_select_columns || $sql$
      coalesce(trim(item->>'title'), trim(item->>'name'), 'Certificación'),
      nullif(trim(item->>'issuer'), ''),
      case
        when coalesce(item->>'date', item->>'issue_date', '') ~ '^\d{4}-\d{2}-\d{2}$' then (coalesce(item->>'date', item->>'issue_date'))::date
        when coalesce(item->>'date', item->>'issue_date', '') ~ '^\d{4}-\d{2}$' then ((coalesce(item->>'date', item->>'issue_date')) || '-01')::date
        when coalesce(item->>'date', item->>'issue_date', '') ~ '^\d{4}$' then ((coalesce(item->>'date', item->>'issue_date')) || '-01-01')::date
        else null
      end,
      nullif(trim(coalesce(item->>'certificate_title', item->>'credential_id', '')), ''),
      nullif(trim(coalesce(item->>'description', '')), ''),
      'legacy',
      ordinality - 1,
      true
    $sql$;

    execute format(
      $sql$
      insert into public.candidate_certifications (%s)
      select %s
      from public.candidate_profiles cp
      cross join lateral jsonb_array_elements(coalesce(cp.certifications, '[]'::jsonb)) with ordinality as items(item, ordinality)
      where lower(coalesce(item->>'category', 'certificacion')) <> 'idioma'
        and not exists (
          select 1
          from public.candidate_certifications cc
          where cc.user_id = cp.user_id
        )
      $sql$,
      certification_insert_columns,
      certification_select_columns
    );
  end if;
end $$;
