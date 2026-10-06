-- Plantilla de producto independiente para respuestas solicitadas por el cliente.
-- Solo se inicializa cuando no existe; conserva cualquier texto que ya haya editado un operador.
INSERT INTO public.templates (nombre, tipo, contenido, activo)
SELECT 'Datos de acceso solicitados', 'datos_acceso',
$message$Hola {nombre_cliente}, estos son los datos de acceso que solicitaste:

{{#items}}
*{servicio}*
Correo: {correo}
Contraseña: {contrasena}
Perfil: {perfil_nombre}
Código: {codigo}
Vencimiento: {vencimiento}
{{/items}}

Si tienes algún inconveniente para ingresar, responde a este mensaje para ayudarte.

MovieTime PTY$message$, true
WHERE NOT EXISTS (SELECT 1 FROM public.templates WHERE tipo = 'datos_acceso');
