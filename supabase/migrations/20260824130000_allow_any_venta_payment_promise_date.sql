-- Allow payment promises on any valid calendar date.
-- The application still defaults new promises to tomorrow, while the database
-- keeps the atomic read-state update without enforcing a relative date range.

CREATE OR REPLACE FUNCTION public.enforce_venta_payment_promise()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.fecha_prometida_pago IS NOT NULL THEN
    NEW.leida := TRUE;
    NEW.read_at := COALESCE(NEW.read_at, CURRENT_TIMESTAMP);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_venta_payment_promise_before_update
  ON public.notificaciones;

CREATE TRIGGER enforce_venta_payment_promise_before_update
BEFORE UPDATE OF fecha_prometida_pago ON public.notificaciones
FOR EACH ROW
EXECUTE FUNCTION public.enforce_venta_payment_promise();

