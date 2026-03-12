-- f31_evidences_documentary_hardening.sql
-- Hardening del módulo de evidencias:
-- - Persistencia documental explícita
-- - Separación estado interno vs estado UI
-- - Base de trazabilidad para trust score

alter table public.evidences
  add column if not exists document_type text,
  add column if not exists document_scope text,
  add column if not exists trust_weight numeric,
  add column if not exists validation_status text,
  add column if not exists inconsistency_reason text,
  add column if not exists document_issue_date date;

-- Backfill legacy seguro
update public.evidences
set document_type = coalesce(
  document_type,
  case
    when lower(coalesce(evidence_type, '')) like '%vida%' then 'vida_laboral'
    when lower(coalesce(evidence_type, '')) like '%nomina%' then 'nomina'
    when lower(coalesce(evidence_type, '')) like '%contrato%' then 'contrato_trabajo'
    when lower(coalesce(evidence_type, '')) like '%certificado%' then 'certificado_empresa'
    when lower(coalesce(evidence_type, '')) in ('documentary', 'documento') then 'otro_documento'
    else coalesce(evidence_type, 'otro_documento')
  end
)
where document_type is null;

update public.evidences
set document_scope = coalesce(
  document_scope,
  case
    when lower(coalesce(document_type, '')) = 'vida_laboral' then 'global'
    else 'experience'
  end
)
where document_scope is null;

update public.evidences
set trust_weight = coalesce(
  trust_weight,
  case lower(coalesce(document_type, ''))
    when 'vida_laboral' then 1.00
    when 'certificado_empresa' then 0.85
    when 'contrato_trabajo' then 0.80
    when 'nomina' then 0.65
    else 0.35
  end
)
where trust_weight is null;

update public.evidences
set validation_status = coalesce(validation_status, 'needs_review')
where validation_status is null;

-- Constraints suaves (no bloquean filas legacy fuera de catálogo)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'evidences_document_scope_check'
  ) then
    alter table public.evidences
      add constraint evidences_document_scope_check
      check (document_scope in ('global','experience'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'evidences_validation_status_check'
  ) then
    alter table public.evidences
      add constraint evidences_validation_status_check
      check (validation_status in ('uploaded','auto_processing','needs_review','approved','rejected'));
  end if;
end $$;

