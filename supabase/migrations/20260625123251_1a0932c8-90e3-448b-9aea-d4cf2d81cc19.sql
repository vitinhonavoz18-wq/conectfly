DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='table_sessions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.table_sessions';
  END IF;
END$$;

ALTER TABLE public.table_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.table_close_requests REPLICA IDENTITY FULL;