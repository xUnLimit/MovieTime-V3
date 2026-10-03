-- Un aviso pertenece al cliente. Borrar el cliente elimina sus avisos, sin
-- borrar ventas ni pagos; esas referencias conservan su politica anterior.
BEGIN;

ALTER TABLE public.whatsapp_notices
  DROP CONSTRAINT whatsapp_notices_tercero_id_fkey,
  ADD CONSTRAINT whatsapp_notices_tercero_id_fkey
    FOREIGN KEY (tercero_id) REFERENCES public.terceros(id)
    ON DELETE CASCADE NOT VALID;

ALTER TABLE public.whatsapp_notices
  VALIDATE CONSTRAINT whatsapp_notices_tercero_id_fkey;

COMMIT;
