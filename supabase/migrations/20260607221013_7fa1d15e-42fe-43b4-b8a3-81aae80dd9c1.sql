ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS menu_sync_token TEXT UNIQUE;
UPDATE public.restaurants SET menu_sync_token = encode(gen_random_bytes(16), 'hex') WHERE menu_sync_token IS NULL;
GRANT SELECT, UPDATE ON public.restaurants TO authenticated;
GRANT ALL ON public.restaurants TO service_role;