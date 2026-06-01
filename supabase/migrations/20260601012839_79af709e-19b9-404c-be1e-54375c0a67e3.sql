-- Create beverage catalogs table
CREATE TABLE public.beverage_catalogs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add catalog_id to pizzeria_beverages
ALTER TABLE public.pizzeria_beverages 
ADD COLUMN catalog_id UUID REFERENCES public.beverage_catalogs(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.beverage_catalogs ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.beverage_catalogs TO authenticated;
GRANT SELECT ON public.beverage_catalogs TO anon;
GRANT ALL ON public.beverage_catalogs TO service_role;

-- Policies for beverage_catalogs
CREATE POLICY "Users can manage their own beverage catalogs"
ON public.beverage_catalogs
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.restaurants r
        WHERE r.id = beverage_catalogs.restaurant_id
        AND (r.id IN (SELECT restaurant_id FROM user_roles WHERE user_id = auth.uid()) OR (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'admin')
    )
);

CREATE POLICY "Beverage catalogs are viewable by everyone"
ON public.beverage_catalogs
FOR SELECT
USING (active = true);

-- Add trigger for updated_at
CREATE TRIGGER update_beverage_catalogs_updated_at
BEFORE UPDATE ON public.beverage_catalogs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
