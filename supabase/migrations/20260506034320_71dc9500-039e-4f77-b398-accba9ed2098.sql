ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS flycontrol_base_url text,
  ADD COLUMN IF NOT EXISTS flycontrol_tenant_id text;