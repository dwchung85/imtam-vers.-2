ALTER TABLE public.houses
  ADD COLUMN residency_doc_registration TEXT NOT NULL DEFAULT '',
  ADD COLUMN residency_doc_utility TEXT NOT NULL DEFAULT '';