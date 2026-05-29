CREATE TABLE public.order_submission_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    source TEXT NOT NULL, -- 'admin_test' ou 'public_checkout'
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    order_id TEXT,
    webhook_url TEXT,
    payload JSONB,
    status INTEGER,
    response JSONB,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Grants
GRANT INSERT, SELECT ON public.order_submission_logs TO authenticated;
GRANT ALL ON public.order_submission_logs TO service_role;
GRANT INSERT ON public.order_submission_logs TO anon;

-- RLS
ALTER TABLE public.order_submission_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view logs for their own restaurants" 
ON public.order_submission_logs 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.restaurants 
        WHERE id = order_submission_logs.restaurant_id 
        AND owner_id = auth.uid()
    )
);

CREATE POLICY "Anyone can insert logs" 
ON public.order_submission_logs 
FOR INSERT 
WITH CHECK (true);
