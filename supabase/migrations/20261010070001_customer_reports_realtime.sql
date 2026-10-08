-- Se ejecuta despues de la creacion de customer_reports. Conserva SELECT y RLS de administradores.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'customer_reports'
    ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_reports;
  END IF;
END;
$$;
