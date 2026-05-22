-- Function to generate a clean subdomain
CREATE OR REPLACE FUNCTION public.generate_clean_subdomain(input_text TEXT)
RETURNS TEXT AS $$
DECLARE
    clean_sub TEXT;
    final_sub TEXT;
    counter INTEGER := 0;
BEGIN
    -- Lowercase and remove all non-alphanumeric characters
    clean_sub := lower(regexp_replace(input_text, '[^a-zA-Z0-9]', '', 'g'));
    
    -- Fallback if empty
    IF clean_sub = '' THEN
        clean_sub := 'site';
    END IF;
    
    final_sub := clean_sub;
    
    -- Ensure uniqueness within the restaurants table
    WHILE EXISTS (SELECT 1 FROM public.restaurants WHERE custom_subdomain = final_sub) LOOP
        counter := counter + 1;
        final_sub := clean_sub || counter::text;
    END LOOP;
    
    RETURN final_sub;
END;
$$ LANGUAGE plpgsql;

-- Update existing restaurants where custom_subdomain is NULL
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id, name FROM public.restaurants WHERE custom_subdomain IS NULL OR custom_subdomain = '' LOOP
        UPDATE public.restaurants 
        SET custom_subdomain = public.generate_clean_subdomain(r.name)
        WHERE id = r.id;
    END LOOP;
END $$;
