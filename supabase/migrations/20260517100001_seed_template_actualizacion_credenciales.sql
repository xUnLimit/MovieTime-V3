-- Plantilla base para notificar cambios de credenciales.

INSERT INTO templates (nombre, tipo, contenido, activo)
SELECT
  'Actualizacion de credenciales',
  'actualizacion_credenciales',
  '{saludo} {nombre_cliente}, te compartimos la actualizacion de acceso para *{servicio}*.

{credenciales_cambiadas}

Correo: {correo}
Contrasena: {contrasena}
Perfil: {perfil_nombre}
Codigo: {codigo}

Por favor usa estos datos desde ahora.',
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM templates
  WHERE tipo = 'actualizacion_credenciales'
);
