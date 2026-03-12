-- f31_company_verification_documents.sql
-- Perfil empresa: soporte documental múltiple para verificación de empresa.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'company_profiles'
  ) THEN
    ALTER TABLE public.company_profiles
      ADD COLUMN IF NOT EXISTS contact_person_role text;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.company_verification_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  uploaded_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  document_type text NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'evidence',
  storage_path text NOT NULL,
  original_filename text,
  mime_type text,
  size_bytes bigint,
  review_status text NOT NULL DEFAULT 'pending_review',
  rejected_reason text,
  review_notes text,
  reviewed_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'company_verification_documents_review_status_check'
  ) THEN
    ALTER TABLE public.company_verification_documents
      ADD CONSTRAINT company_verification_documents_review_status_check
      CHECK (review_status IN ('pending_review', 'approved', 'rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_company_verification_documents_company_id
  ON public.company_verification_documents(company_id);

CREATE INDEX IF NOT EXISTS idx_company_verification_documents_review_status
  ON public.company_verification_documents(review_status);

CREATE INDEX IF NOT EXISTS idx_company_verification_documents_created_at
  ON public.company_verification_documents(created_at DESC);

