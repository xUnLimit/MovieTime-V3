BEGIN;

UPDATE public.metodos_pago
SET
  asociado_a = CASE
    WHEN tipo_cuenta IS NOT NULL THEN 'usuario'::public.asociado_a_enum
    ELSE 'servicio'::public.asociado_a_enum
  END,
  updated_at = now()
WHERE asociado_a IS NULL;

DELETE FROM public.metodos_pago
WHERE alias = 'legacy-placeholder';

COMMIT;
