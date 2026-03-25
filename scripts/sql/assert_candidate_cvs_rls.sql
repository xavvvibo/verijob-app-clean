\set ON_ERROR_STOP on

-- Uso:
--   psql "$DATABASE_URL" \
--     -v candidate_a="'00000000-0000-0000-0000-000000000001'" \
--     -v candidate_b="'00000000-0000-0000-0000-000000000002'" \
--     -f scripts/sql/assert_candidate_cvs_rls.sql
--
-- Expected result:
--   - El script termina sin errores
--   - Candidate A inserta/lee/actualiza solo su fila
--   - Candidate B no puede leer ni actualizar filas de A
--   - anon no puede leer filas

begin;

reset role;

do $$
declare
  rls_enabled boolean;
  policy_count integer;
begin
  select relrowsecurity into rls_enabled
  from pg_class
  where oid = 'public.candidate_cvs'::regclass;

  if not coalesce(rls_enabled, false) then
    raise exception 'candidate_cvs_rls_disabled';
  end if;

  select count(*) into policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'candidate_cvs'
    and policyname in ('candidate_insert_cvs', 'candidate_select_cvs', 'candidate_update_cvs');

  if policy_count <> 3 then
    raise exception 'candidate_cvs_policy_count_invalid:%', policy_count;
  end if;
end
$$;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', :'candidate_a', true);

do $$
begin
  if auth.uid()::text <> trim(both '''' from :'candidate_a') then
    raise exception 'candidate_a_auth_uid_mismatch:%', auth.uid();
  end if;
end
$$;

insert into public.candidate_cvs (
  user_id
)
values (
  :'candidate_a'
)
returning id, user_id;

do $$
declare
  own_rows integer;
begin
  select count(*) into own_rows
  from public.candidate_cvs
  where user_id = :'candidate_a';

  if own_rows < 1 then
    raise exception 'candidate_a_cannot_read_own_rows';
  end if;
end
$$;

update public.candidate_cvs
set user_id = :'candidate_a'
where user_id = :'candidate_a';

do $$
declare
  updated_rows integer;
begin
  get diagnostics updated_rows = row_count;
  if updated_rows < 1 then
    raise exception 'candidate_a_update_own_rows_failed';
  end if;
end
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', :'candidate_b', true);

do $$
begin
  if auth.uid()::text <> trim(both '''' from :'candidate_b') then
    raise exception 'candidate_b_auth_uid_mismatch:%', auth.uid();
  end if;
end
$$;

do $$
declare
  foreign_rows integer;
begin
  select count(*) into foreign_rows
  from public.candidate_cvs
  where user_id = :'candidate_a';

  if foreign_rows <> 0 then
    raise exception 'candidate_b_can_read_candidate_a_rows';
  end if;
end
$$;

update public.candidate_cvs
set user_id = :'candidate_b'
where user_id = :'candidate_a';

do $$
declare
  updated_rows integer;
begin
  get diagnostics updated_rows = row_count;
  if updated_rows <> 0 then
    raise exception 'candidate_b_can_update_candidate_a_rows';
  end if;
end
$$;

reset role;
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);

do $$
declare
  anon_rows integer;
begin
  select count(*) into anon_rows
  from public.candidate_cvs;

  if anon_rows <> 0 then
    raise exception 'anon_can_read_candidate_cvs';
  end if;
end
$$;

rollback;
