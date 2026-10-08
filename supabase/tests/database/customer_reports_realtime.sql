BEGIN;
SELECT plan(2);
SELECT ok(EXISTS (
  SELECT 1 FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'customer_reports'
), 'Reportes publica cambios en Realtime');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.customer_reports'::regclass),
  'La publicacion conserva RLS en reportes');
SELECT * FROM finish();
ROLLBACK;
