-- Los pedidos archivados conservan su auditoría, pero no bloquean la baja del cliente.
-- Los pedidos vigentes siguen exigiendo resolver su reserva y su historial financiero.
BEGIN;
-- Eliminar del panel es archivar: también admite pedidos finalizados, sin borrar pagos ni ventas.
CREATE OR REPLACE FUNCTION public.mt_delete_order(p_order_id uuid,p_idempotency_key uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE existing uuid; p public.pedidos%ROWTYPE;
BEGIN
 IF (SELECT private.auth_role()) IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 existing:=private.mt_intent('delete:' || p_order_id::text,p_idempotency_key);
 IF existing IS NOT NULL THEN RETURN existing::text; END IF;
 SELECT * INTO p FROM public.pedidos WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'pedido_not_found'; END IF;
 IF p.deleted_at IS NULL THEN
   IF NOT EXISTS (SELECT 1 FROM public.pedido_pagos WHERE pedido_id=p.id)
     AND NOT EXISTS (SELECT 1 FROM public.pedido_items WHERE pedido_id=p.id AND (venta_id IS NOT NULL OR venta_id_resultante IS NOT NULL)) THEN
     UPDATE public.pedido_items SET estado='cancelado' WHERE pedido_id=p.id;
     UPDATE public.pedidos SET estado='cancelado' WHERE id=p.id;
   END IF;
   UPDATE public.reservas_perfil SET cerrada_at=clock_timestamp() WHERE pedido_id=p.id AND cerrada_at IS NULL;
   UPDATE public.pedidos SET deleted_at=now(),deleted_by=auth.uid() WHERE id=p.id;
 END IF;
 INSERT INTO public.pedido_operaciones VALUES(private.mt_actor(),'delete:' || p_order_id::text,p_idempotency_key,p.id,now());
 RETURN p.id::text;
END;
$$;
ALTER TABLE public.pedidos DROP CONSTRAINT pedidos_check;
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_check
  CHECK (tercero_id IS NOT NULL OR contact_id IS NOT NULL OR deleted_at IS NOT NULL) NOT VALID;
ALTER TABLE public.pedidos VALIDATE CONSTRAINT pedidos_check;

CREATE FUNCTION private.mt_release_deleted_customer_orders() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.pedidos WHERE tercero_id=OLD.id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'tercero_has_active_orders' USING ERRCODE='P0001';
  END IF;
  UPDATE public.pedidos SET tercero_id=NULL,notice_id=NULL WHERE tercero_id=OLD.id AND deleted_at IS NOT NULL;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION private.mt_release_deleted_customer_orders() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER mt_release_deleted_customer_orders BEFORE DELETE ON public.terceros
  FOR EACH ROW EXECUTE FUNCTION private.mt_release_deleted_customer_orders();
COMMIT;
