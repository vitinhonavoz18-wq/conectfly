ALTER TABLE public.menu_categories
  ADD COLUMN IF NOT EXISTS is_pizza boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pizza_sizes jsonb;