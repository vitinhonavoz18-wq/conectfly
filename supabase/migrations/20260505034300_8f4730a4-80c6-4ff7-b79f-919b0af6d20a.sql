ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS flycontrol_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flycontrol_api_url text,
  ADD COLUMN IF NOT EXISTS flycontrol_api_key text,
  ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean NOT NULL DEFAULT true;