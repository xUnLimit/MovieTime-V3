-- Publicar cambios para invalidar la bandeja; Realtime conserva los permisos SELECT y RLS existentes.
DO $$
DECLARE
  target_table TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH target_table IN ARRAY ARRAY[
      'whatsapp_inbound_messages',
      'whatsapp_outbound_messages',
      'whatsapp_message_statuses',
      'whatsapp_conversation_reads',
      'whatsapp_conversation_flags'
    ] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = target_table
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', target_table);
      END IF;
    END LOOP;
  END IF;
END;
$$;
