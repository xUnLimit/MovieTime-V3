-- Resolving money which was never allocated to sale income uses its own ledger.
-- Reembolso records an external transfer already verified by an administrator.
CREATE TABLE public.pedido_exceso_resoluciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id),
  action text NOT NULL CHECK (action IN ('credito','reembolsado')),
  monto numeric(12,2) NOT NULL CHECK (monto>0 AND monto<>'NaN'::numeric),
  moneda text NOT NULL REFERENCES public.currencies(code),
  reference text NOT NULL CHECK (length(btrim(reference)) BETWEEN 4 AND 100),
  created_by uuid NOT NULL REFERENCES public.usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(action, reference)
);
CREATE INDEX pedido_exceso_resoluciones_pedido_idx ON public.pedido_exceso_resoluciones(pedido_id);
ALTER TABLE public.pedido_exceso_resoluciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pedido_exceso_resoluciones FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY pedido_exceso_resoluciones_read ON public.pedido_exceso_resoluciones FOR SELECT TO authenticated
  USING ((SELECT private.auth_role())='admin' AND (SELECT public.is_authenticated()));
GRANT SELECT ON public.pedido_exceso_resoluciones TO authenticated;

CREATE FUNCTION public.mt_resolve_excess(p_order_id uuid,p_action text,p_reference text,p_expected_amount numeric,p_idempotency_key uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE existing uuid; p public.pedidos%ROWTYPE; balance public.pedido_excedentes%ROWTYPE;
BEGIN
 IF NOT public.is_authenticated() OR private.auth_role() IS DISTINCT FROM 'admin'
   THEN RAISE EXCEPTION 'pedido_forbidden' USING ERRCODE='42501'; END IF;
 existing:=private.mt_intent('excess:' || p_order_id::text || ':' || p_action,p_idempotency_key);
 IF existing IS NOT NULL THEN RETURN existing::text; END IF;
 IF p_action IS NULL OR p_action NOT IN ('credito','reembolsado') OR p_reference IS NULL
   OR p_reference !~ '^[A-Za-z0-9 ._:/-]{4,100}$' OR p_expected_amount IS NULL OR p_expected_amount<=0
   OR p_expected_amount='NaN'::numeric THEN RAISE EXCEPTION 'pedido_invalid_excess_resolution'; END IF;
 SELECT * INTO p FROM public.pedidos WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'pedido_invalid'; END IF;
 SELECT * INTO balance FROM public.pedido_excedentes WHERE pedido_id=p.id FOR UPDATE;
 IF NOT FOUND OR balance.estado<>'pendiente' OR balance.monto<>p_expected_amount
   THEN RAISE EXCEPTION 'pedido_excess_changed'; END IF;
 INSERT INTO public.pedido_exceso_resoluciones(pedido_id,action,monto,moneda,reference,created_by)
   VALUES(p.id,p_action,balance.monto,balance.moneda,btrim(p_reference),auth.uid());
 UPDATE public.pedido_excedentes SET estado=p_action,updated_at=now() WHERE pedido_id=p.id;
 UPDATE public.pedidos SET excess_settled_amount=excess_settled_amount+balance.monto WHERE id=p.id;
 INSERT INTO public.pedido_operaciones VALUES(private.mt_actor(),'excess:' || p.id::text || ':' || p_action,p_idempotency_key,p.id,now());
 RETURN p.id::text;
END;
$$;
REVOKE ALL ON FUNCTION public.mt_resolve_excess(uuid,text,text,numeric,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.mt_resolve_excess(uuid,text,text,numeric,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
