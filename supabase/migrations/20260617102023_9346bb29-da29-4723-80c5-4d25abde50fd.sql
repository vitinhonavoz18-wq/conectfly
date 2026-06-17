
CREATE TABLE public.table_close_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
  table_number TEXT NOT NULL,
  table_session_id UUID REFERENCES public.table_sessions(id) ON DELETE SET NULL,
  current_total NUMERIC NOT NULL DEFAULT 0,
  order_count INTEGER NOT NULL DEFAULT 0,
  customer_name TEXT,
  customer_phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  allow_additional_orders BOOLEAN NOT NULL DEFAULT true,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  requested_by_ip TEXT,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tcr_restaurant_status ON public.table_close_requests(restaurant_id, status);
CREATE INDEX idx_tcr_session ON public.table_close_requests(table_session_id);
CREATE UNIQUE INDEX uniq_tcr_pending_per_session
  ON public.table_close_requests(table_session_id)
  WHERE status = 'pending' AND table_session_id IS NOT NULL;
CREATE UNIQUE INDEX uniq_tcr_pending_per_table
  ON public.table_close_requests(table_id)
  WHERE status = 'pending' AND table_session_id IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.table_close_requests TO authenticated;
GRANT ALL ON public.table_close_requests TO service_role;

ALTER TABLE public.table_close_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins can view their close requests"
  ON public.table_close_requests FOR SELECT
  TO authenticated
  USING (public.owns_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Owners and admins can update their close requests"
  ON public.table_close_requests FOR UPDATE
  TO authenticated
  USING (public.owns_restaurant(auth.uid(), restaurant_id))
  WITH CHECK (public.owns_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Owners and admins can delete their close requests"
  ON public.table_close_requests FOR DELETE
  TO authenticated
  USING (public.owns_restaurant(auth.uid(), restaurant_id));

CREATE TRIGGER set_tcr_updated_at
  BEFORE UPDATE ON public.table_close_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.table_close_requests;
ALTER TABLE public.table_close_requests REPLICA IDENTITY FULL;
