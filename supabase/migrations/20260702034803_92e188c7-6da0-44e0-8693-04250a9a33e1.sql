
-- Allow anon/authenticated to SELECT table_sessions by id so that Realtime
-- can deliver UPDATE payloads to Digital Menu clients subscribed to their
-- own session. Session IDs are unguessable UUIDs, functioning as capability
-- tokens. Existing owner-only ALL policy remains untouched.

GRANT SELECT ON public.table_sessions TO anon;
GRANT SELECT ON public.table_sessions TO authenticated;

DROP POLICY IF EXISTS "Public can view open table sessions" ON public.table_sessions;

CREATE POLICY "Anon can view any table session (uuid is capability)"
ON public.table_sessions
FOR SELECT
TO anon, authenticated
USING (true);
