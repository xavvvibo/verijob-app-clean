do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'candidate_cvs'
  ) then
    alter table public.candidate_cvs enable row level security;

    drop policy if exists candidate_insert_cvs on public.candidate_cvs;
    drop policy if exists candidate_select_cvs on public.candidate_cvs;
    drop policy if exists candidate_update_cvs on public.candidate_cvs;

    create policy candidate_insert_cvs
      on public.candidate_cvs
      for insert
      to authenticated
      with check (user_id = auth.uid());

    create policy candidate_select_cvs
      on public.candidate_cvs
      for select
      to authenticated
      using (user_id = auth.uid());

    create policy candidate_update_cvs
      on public.candidate_cvs
      for update
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end
$$;
