CREATE TABLE public.pizzeria_pizza_sizes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    pizzeria_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL DEFAULT 0,
    max_flavors INTEGER NOT NULL DEFAULT 1,
    slices INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pizzeria_pizza_sizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pizza sizes are viewable by everyone" 
ON public.pizzeria_pizza_sizes 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage their pizza sizes" 
ON public.pizzeria_pizza_sizes 
FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.restaurants r 
    WHERE r.id = pizzeria_pizza_sizes.pizzeria_id
));

DO $$
DECLARE
    cat RECORD;
    size_item JSONB;
BEGIN
    FOR cat IN SELECT id, restaurant_id, pizza_sizes FROM menu_categories WHERE is_pizza = true AND pizza_sizes IS NOT NULL LOOP
        FOR size_item IN SELECT jsonb_array_elements(cat.pizza_sizes) LOOP
            INSERT INTO pizzeria_pizza_sizes (pizzeria_id, name, price, max_flavors, slices, sort_order)
            VALUES (
                cat.restaurant_id, 
                size_item->>'label', 
                (size_item->>'price')::numeric, 
                (size_item->>'max_flavors')::integer,
                CASE 
                    WHEN size_item->>'label' = 'Pequena' THEN 4
                    WHEN size_item->>'label' = 'Média' THEN 6
                    WHEN size_item->>'label' = 'Grande' THEN 8
                    WHEN size_item->>'label' = 'Família' THEN 12
                    ELSE 8
                END,
                CASE 
                    WHEN size_item->>'label' = 'Pequena' THEN 1
                    WHEN size_item->>'label' = 'Média' THEN 2
                    WHEN size_item->>'label' = 'Grande' THEN 3
                    WHEN size_item->>'label' = 'Família' THEN 4
                    ELSE 5
                END
            ) ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
END $$;