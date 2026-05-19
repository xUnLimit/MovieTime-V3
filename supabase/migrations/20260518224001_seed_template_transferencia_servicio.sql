-- Plantilla base para notificar transferencias de servicio.

INSERT INTO templates (nombre, tipo, contenido, activo)
SELECT
  'Transferencia de servicio',
  'transferencia_servicio',
  '{saludo} {nombre_cliente}, tu acceso fue transferido a *{servicio}*.

Estas son tus credenciales actualizadas:

Correo: {correo}
Contrasena: {contrasena}
Perfil: {perfil_nombre}
Codigo: {codigo}

Por favor usa este servicio desde ahora.',
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM templates
  WHERE tipo = 'transferencia_servicio'
);
