-- Un solo tipo de aviso de pago: "Aviso de vencimiento" (dia_pago) cubre antes y el dia del vencimiento.
-- notificacion_regular queda en el enum solo por el historial de avisos; su plantilla se elimina.
UPDATE public.templates SET nombre = 'Aviso de vencimiento' WHERE tipo = 'dia_pago';
DELETE FROM public.templates WHERE tipo = 'notificacion_regular';
