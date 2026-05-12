
-- Create the audit log table
CREATE TABLE public.flycontrol_order_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  idempotency_key TEXT,
  payload JSONB NOT NULL,
  status_code INTEGER,
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  response_body TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.flycontrol_order_logs ENABLE ROW LEVEL SECURITY;

-- Add index for performance
CREATE INDEX idx_flycontrol_order_logs_restaurant_id ON public.flycontrol_order_logs(restaurant_id);
CREATE INDEX idx_flycontrol_order_logs_created_at ON public.flycontrol_order_logs(created_at);

-- Create policies
CREATE POLICY "Owners can view their own order logs"
ON public.flycontrol_order_logs
FOR SELECT
TO authenticated
USING (public.owns_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Admins can view all order logs"
ON public.flycontrol_order_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
