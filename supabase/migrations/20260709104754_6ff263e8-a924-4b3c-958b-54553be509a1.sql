
ALTER TABLE public.menu_categories      ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public.menu_items           ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public.pizzeria_beverages   ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public.combos               ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public.delivery_zones       ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public.pizzeria_pizza_sizes ADD COLUMN IF NOT EXISTS external_id text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_menu_categories_ext      ON public.menu_categories      (restaurant_id, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_menu_items_ext           ON public.menu_items           (restaurant_id, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_pizzeria_beverages_ext   ON public.pizzeria_beverages   (pizzeria_id,  external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_combos_ext               ON public.combos               (restaurant_id, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_zones_ext       ON public.delivery_zones       (restaurant_id, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_pizzeria_pizza_sizes_ext ON public.pizzeria_pizza_sizes (pizzeria_id,  external_id) WHERE external_id IS NOT NULL;
