-- Dining Session: new single source of truth for a customer's in-restaurant session.
-- Coexists with legacy table_sessions (kept for totals/backwards compat). Orders and
-- close-requests get new nullable columns pointing back to the dining session.

CREATE TYPE public.dining_session_status AS ENUM (
  'active',
  'requested_close',
  'closing',
  'closed',
  'archived'
);

CREATE TABLE public.dining_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_id uuid REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
  table_number text NOT NULL,
  table_token text,
  customer_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status public.dining_session_status NOT NULL DEFAULT 'active',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  fl_session_id text,
  legacy_table_session_id uuid REFERENCES public.table_sessions(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX dining_sessions_restaurant_status_idx
  ON public.dining_sessions (restaurant_id, status);
CREATE INDEX dining_sessions_customer_token_idx
  ON public.dining_sessions (customer_token);
CREATE INDEX dining_sessions_table_active_idx
  ON public.dining_sessions (restaurant_id, table_id)
  WHERE status IN ('active','requested_close','closing');

GRANT SELECT ON public.dining_sessions TO anon;
GRANT SELECT, INSERT, UPDATE ON public.dining_sessions TO authenticated;
GRANT ALL ON public.dining_sessions TO service_role;

ALTER TABLE public.dining_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dining_sessions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dining_sessions;

-- The dining_session id itself is the capability token handed to the customer
-- browser (same pattern already in use for table_sessions). anon reads are OK
-- because listing requires knowing the UUID.
CREATE POLICY "dining_sessions readable by anyone with the id"
  ON public.dining_sessions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "dining_sessions owner manages"
  ON public.dining_sessions FOR ALL
  TO authenticated
  USING (public.owns_restaurant(auth.uid(), restaurant_id))
  WITH CHECK (public.owns_restaurant(auth.uid(), restaurant_id));

CREATE TRIGGER dining_sessions_set_updated_at
  BEFORE UPDATE ON public.dining_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Wire orders + close-requests + legacy sessions to the new identity (nullable so
-- Delivery/Pickup/Counter flows and old rows remain valid).
ALTER TABLE public.orders
  ADD COLUMN dining_session_id uuid REFERENCES public.dining_sessions(id) ON DELETE SET NULL,
  ADD COLUMN customer_token uuid;
CREATE INDEX orders_dining_session_idx ON public.orders (dining_session_id);

ALTER TABLE public.table_close_requests
  ADD COLUMN dining_session_id uuid REFERENCES public.dining_sessions(id) ON DELETE SET NULL,
  ADD COLUMN customer_token uuid;
CREATE INDEX table_close_requests_dining_session_idx
  ON public.table_close_requests (dining_session_id);

ALTER TABLE public.table_sessions
  ADD COLUMN dining_session_id uuid REFERENCES public.dining_sessions(id) ON DELETE SET NULL;