-- Add new fields to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'Pizzaria',
ADD COLUMN IF NOT EXISTS theme_settings JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS site_settings JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS checkout_settings JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS delivery_settings JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS seo_settings JSONB DEFAULT '{}'::jsonb;

-- Update existing records to have a default business_type if null
UPDATE public.restaurants SET business_type = 'Pizzaria' WHERE business_type IS NULL;

-- Create an index for business_type to help with filtering/analytics later
CREATE INDEX IF NOT EXISTS idx_restaurants_business_type ON public.restaurants(business_type);
