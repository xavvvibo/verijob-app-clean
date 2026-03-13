-- f34_company_verification_documents_lifecycle.sql
-- Hardening documental de empresa: lifecycle, extracción e importación con trazabilidad.

ALTER TABLE IF EXISTS public.company_verification_documents
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replaced_by_document_id uuid NULL REFERENCES public.company_verification_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS extracted_json jsonb,
  ADD COLUMN IF NOT EXISTS extracted_at timestamptz,
  ADD COLUMN IF NOT EXISTS import_status text NOT NULL DEFAULT 'not_imported',
  ADD COLUMN IF NOT EXISTS imported_at timestamptz,
  ADD COLUMN IF NOT EXISTS imported_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS import_notes text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'company_verification_documents_lifecycle_status_check'
  ) THEN
    ALTER TABLE public.company_verification_documents
      ADD CONSTRAINT company_verification_documents_lifecycle_status_check
      CHECK (lifecycle_status IN ('active', 'deleted'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'company_verification_documents_import_status_check'
  ) THEN
    ALTER TABLE public.company_verification_documents
      ADD CONSTRAINT company_verification_documents_import_status_check
      CHECK (import_status IN ('not_imported', 'imported', 'no_changes', 'failed'));
  END IF;
END $$;

UPDATE public.company_verification_documents
SET lifecycle_status = 'active'
WHERE lifecycle_status IS NULL;

UPDATE public.company_verification_documents
SET import_status = 'not_imported'
WHERE import_status IS NULL;

UPDATE public.company_verification_documents
SET status = CASE
  WHEN lifecycle_status = 'deleted' OR deleted_at IS NOT NULL THEN 'deleted'
  WHEN review_status IN ('approved', 'rejected') THEN review_status
  ELSE 'pending_review'
END
WHERE status IS DISTINCT FROM CASE
  WHEN lifecycle_status = 'deleted' OR deleted_at IS NOT NULL THEN 'deleted'
  WHEN review_status IN ('approved', 'rejected') THEN review_status
  ELSE 'pending_review'
END;

CREATE INDEX IF NOT EXISTS idx_company_verification_documents_lifecycle
  ON public.company_verification_documents(company_id, lifecycle_status, created_at DESC);
