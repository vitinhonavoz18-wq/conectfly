ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS is_special boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS special_extra numeric NOT NULL DEFAULT 0;