-- Idempotent backfill: only fills NULL/empty external_id using the row's internal UUID
-- Format: sf_<uuid> — stable, unique per row, easy to identify as SF-origin

UPDATE public.menu_categories
SET external_id = 'sf_' || id::text
WHERE external_id IS NULL OR external_id = '';

UPDATE public.menu_items
SET external_id = 'sf_' || id::text
WHERE external_id IS NULL OR external_id = '';

UPDATE public.pizzeria_beverages
SET external_id = 'sf_' || id::text
WHERE external_id IS NULL OR external_id = '';

UPDATE public.combos
SET external_id = 'sf_' || id::text
WHERE external_id IS NULL OR external_id = '';

UPDATE public.pizzeria_pizza_sizes
SET external_id = 'sf_' || id::text
WHERE external_id IS NULL OR external_id = '';

UPDATE public.delivery_zones
SET external_id = 'sf_' || id::text
WHERE external_id IS NULL OR external_id = '';
