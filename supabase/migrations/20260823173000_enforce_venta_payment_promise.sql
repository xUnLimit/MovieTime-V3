-- Enforce the payment-promise rules at the database boundary as well as in the UI.
-- This keeps direct authenticated updates consistent with the application use case.

CREATE OR REPLACE FUNCTION public.enforce_venta_payment_promise()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.fecha_prometida_pago IS NOT NULL THEN
    IF NEW.fecha_prometida_pago <=
       (CURRENT_TIMESTAMP AT TIME ZONE 'America/Panama')::date THEN
      RAISE EXCEPTION 'La fecha prometida de pago debe ser posterior a hoy'
        USING ERRCODE = '22007';
    END IF;

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
