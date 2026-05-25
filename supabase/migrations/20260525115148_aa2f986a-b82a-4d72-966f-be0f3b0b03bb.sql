-- Security: Revoke direct access to sensitive API keys from the frontend
REVOKE SELECT (flycontrol_api_key) ON public.restaurants FROM anon, authenticated;

-- Ensure service_role (used by Lovable backend) still has access
GRANT SELECT (flycontrol_api_key) ON public.restaurants TO service_role;

-- Create a secure RPC for owners to see their own key (e.g. for the admin panel)
CREATE OR REPLACE FUNCTION public.get_restaurant_flycontrol_key(p_restaurant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_key TEXT;
    v_owner_id UUID;
BEGIN
    -- Get the owner_id of the restaurant
    SELECT owner_id, flycontrol_api_key INTO v_owner_id, v_key
    FROM public.restaurants
    WHERE id = p_restaurant_id;

    -- Check if the current user is the owner or an admin
    IF (auth.uid() = v_owner_id) OR (EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )) THEN
        RETURN v_key;
    ELSE
        RETURN NULL;
    END IF;
END;
$$;

-- Grant access to the RPC
GRANT EXECUTE ON FUNCTION public.get_restaurant_flycontrol_key(UUID) TO authenticated;
