-- Ventas creadas por un pedido pagado del contacto: el bot las usa para entregar los datos tras confirmar el pago.
-- Solo service_role. La propiedad se comprueba contra el contacto del pedido; el detalle de acceso sigue saliendo
-- unicamente por credenciales_venta_bot (que nunca devuelve la contrasena de cuentas con acceso por codigo).
CREATE FUNCTION public.ventas_pedido_bot(p_wa_id text, p_pedido_id uuid) RETURNS text[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_wa_id IS NULL OR p_wa_id !~ '^[0-9]{7,15}$' OR p_pedido_id IS NULL THEN
    RAISE EXCEPTION 'purchase_invalid_input' USING ERRCODE = '22023';
  END IF;
  RETURN coalesce((SELECT array_agg(pi.venta_id_resultante ORDER BY pi.id)
    FROM public.pedido_items pi JOIN public.pedidos pd ON pd.id = pi.pedido_id
    WHERE pd.id = p_pedido_id AND pd.contact_id = p_wa_id AND pd.estado IN ('pagado', 'entregado')
      AND pi.estado = 'aplicado' AND pi.venta_id_resultante IS NOT NULL), ARRAY[]::text[]);
END;
$$;
REVOKE ALL ON FUNCTION public.ventas_pedido_bot(text, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ventas_pedido_bot(text, uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
