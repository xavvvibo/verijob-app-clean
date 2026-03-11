-- F30: deduplicación robusta de verification_requests activas por email
--
-- Regla de activo:
--   verification_channel = 'email'
--   status <> 'revoked'
--   external_resolved is not true
--
-- 1) DIAGNÓSTICO PREVIO (obligatorio antes de crear el índice)
--    Lista grupos duplicados activos + ids y fechas para decidir limpieza.
--
--    Nota: se usa coalesce(requested_at, created_at) para ordenar trazabilidad temporal.
--    El esquema del proyecto ya usa ambos campos en distintos flujos.
with active as (
  select
    id,
    requested_by,
    employment_record_id,
    lower(btrim(external_email_target)) as external_email_target_norm,
    verification_channel,
    status,
    external_resolved,
    requested_at,
    created_at
  from public.verification_requests
  where verification_channel = 'email'
    and coalesce(status::text, '') <> 'revoked'
    and external_resolved is not true
    and external_email_target is not null
    and btrim(external_email_target) <> ''
),
dupe_groups as (
  select
    requested_by,
    employment_record_id,
    external_email_target_norm,
    count(*) as active_count,
    array_agg(id order by coalesce(requested_at, created_at), id) as request_ids,
    array_agg(coalesce(requested_at, created_at) order by coalesce(requested_at, created_at), id) as request_dates
  from active
  group by requested_by, employment_record_id, external_email_target_norm
  having count(*) > 1
)
select *
from dupe_groups
order by active_count desc, requested_by, employment_record_id;

-- 2) LIMPIEZA OPCIONAL (solo si el diagnóstico devuelve filas)
--    Criterio conservador: conservar la más antigua, revocar el resto.
--    - Se conserva rn = 1 (orden por coalesce(requested_at, created_at), id asc)
--    - El resto se marca status='revoked'
--    - Se registra resolved_at y resolución en resolution_notes
--
-- BEGIN;
-- with ranked as (
--   select
--     id,
--     row_number() over (
--       partition by requested_by, employment_record_id, lower(btrim(external_email_target))
--       order by coalesce(requested_at, created_at) asc, id asc
--     ) as rn
--   from public.verification_requests
--   where verification_channel = 'email'
--     and coalesce(status::text, '') <> 'revoked'
--     and external_resolved is not true
--     and external_email_target is not null
--     and btrim(external_email_target) <> ''
-- )
-- update public.verification_requests vr
-- set
--   status = 'revoked',
--   resolved_at = coalesce(vr.resolved_at, now()),
--   resolution_notes = trim(
--     both ' | ' from
--     concat_ws(' | ', vr.resolution_notes, 'Auto-revoked por deduplicación activa email (f30)')
--   )
-- from ranked r
-- where vr.id = r.id
--   and r.rn > 1;
-- COMMIT;

-- 3) ÍNDICE ÚNICO PARCIAL (blindaje contra race conditions)
--    Debe ejecutarse después de limpiar duplicados activos, si existen.

create unique index if not exists verification_requests_active_email_dedupe_uq
  on public.verification_requests (
    requested_by,
    employment_record_id,
    (lower(btrim(external_email_target)))
  )
  where verification_channel = 'email'
    and coalesce(status::text, '') <> 'revoked'
    and external_resolved is not true
    and external_email_target is not null
    and btrim(external_email_target) <> '';
