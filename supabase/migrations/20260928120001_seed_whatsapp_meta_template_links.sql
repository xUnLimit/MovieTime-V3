-- Enum values must be committed before rows can use them.
INSERT INTO public.templates (nombre, tipo, contenido, activo)
SELECT 'Datos de pago', 'datos_pago',
  E'✅ ¡Gracias por renovar, {nombre_cliente}!\n\nPuedes realizar el pago de *{servicio}* ({monto}) al siguiente Yappy:\n\n💳 *Allan Ordoñez*\n📱 *6769-4145*\n\nUna vez realizado, envíanos el comprobante por este chat y confirmaremos tu renovación lo más pronto posible.\n\n*— MovieTime PTY*', true
WHERE NOT EXISTS (SELECT 1 FROM public.templates WHERE tipo = 'datos_pago');

INSERT INTO public.templates (nombre, tipo, contenido, activo)
SELECT 'Despedida', 'despedida',
  E'{saludo}, {nombre_cliente}. Recibimos tu respuesta y no continuaremos con tu suscripción a *{servicio}*.\n\nGracias por haber sido parte de MovieTime PTY. Si más adelante quieres volver, aquí estaremos para ayudarte. 😊\n\n*— MovieTime PTY*', true
WHERE NOT EXISTS (SELECT 1 FROM public.templates WHERE tipo = 'despedida');

UPDATE public.templates SET
  meta_template_name = CASE tipo
    WHEN 'notificacion_regular' THEN 'aviso_vencimiento'
    WHEN 'dia_pago' THEN 'aviso_vence_hoy'
    WHEN 'cancelacion' THEN 'aviso_corte'
    ELSE 'acceso_actualizado'
  END,
  meta_param_map = CASE
    WHEN tipo IN ('actualizacion_credenciales', 'transferencia_servicio')
      THEN '["saludo_nombre","servicios"]'::jsonb
    ELSE '["saludo_nombre","servicios","vencimiento","monto_total"]'::jsonb
  END
WHERE tipo IN ('notificacion_regular', 'dia_pago', 'cancelacion',
  'actualizacion_credenciales', 'transferencia_servicio');
