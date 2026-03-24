-- validate_candidate_cvs_rls.sql
-- Requiere dos UUIDs reales de usuarios candidatos distintos.
--
-- Uso recomendado en entorno de staging / review:
--   \set candidate_a '00000000-0000-0000-0000-000000000001'
--   \set candidate_b '00000000-0000-0000-0000-000000000002'
--
-- Si candidate_cvs tiene columnas NOT NULL adicionales sin default, rellénalas en el bloque INSERT marcado.

begin;

select relname, relrowsecurity
from pg_class
where oid = 'public.candidate_cvs'::regclass;

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'candidate_cvs'
order by policyname;

-- Candidate A: insert own row
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', :'candidate_a', true);

insert into public.candidate_cvs (
  user_id
  -- Añade aquí columnas obligatorias adicionales si tu tabla las requiere.
)
values (
  :'candidate_a'
)
returning id, user_id;

-- Candidate A: read own row
select id, user_id
from public.candidate_cvs
where user_id = :'candidate_a'
order by created_at desc nulls last, id desc
limit 1;

-- Candidate A: update own row
update public.candidate_cvs
set user_id = :'candidate_a'
where user_id = :'candidate_a';

-- Candidate B: read A row -> must return 0 rows
select set_config('request.jwt.claim.sub', :'candidate_b', true);

select id, user_id
from public.candidate_cvs
where user_id = :'candidate_a';

-- Candidate B: update A row -> must update 0 rows
update public.candidate_cvs
set user_id = :'candidate_b'
where user_id = :'candidate_a';

rollback;
