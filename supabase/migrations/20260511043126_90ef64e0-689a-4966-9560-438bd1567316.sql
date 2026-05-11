CREATE TABLE IF NOT EXISTS public.pizzeria_beverages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pizzeria_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    brand TEXT,
    size TEXT,
    price NUMERIC NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pizzeria_beverages ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public can view active beverages" 
ON public.pizzeria_beverages 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Owners can manage their own beverages" 
ON public.pizzeria_beverages 
FOR ALL 
USING (pizzeria_id IN (
    SELECT id FROM restaurants WHERE id = pizzeria_beverages.pizzeria_id
));

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pizzeria_beverages_updated_at
BEFORE UPDATE ON public.pizzeria_beverages
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
