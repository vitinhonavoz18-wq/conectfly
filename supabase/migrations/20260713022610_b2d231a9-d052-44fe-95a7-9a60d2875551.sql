-- Colunas de rastreamento de provisionamento
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT 'sitecreator';

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS provisioned_at TIMESTAMPTZ;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS provision_version INTEGER NOT NULL DEFAULT 1;

-- flycontrol_id já foi adicionado em migração anterior; garante o índice único.
CREATE UNIQUE INDEX IF NOT EXISTS restaurants_flycontrol_id_key
  ON public.restaurants (flycontrol_id)
  WHERE flycontrol_id IS NOT NULL;