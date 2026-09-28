# Plantillas Meta v2 (borradores)

Se crean en WhatsApp Manager con nombres nuevos; las 3 actuales siguen operativas hasta aprobar estas.
Todas: categoria UTILITY, idioma `es`. Sin contrasenas ni datos sensibles. Las variables van en una sola linea (maximo 256 caracteres) y nunca al inicio ni al final del cuerpo ni adyacentes.

Variables comunes: `{{1}}` saludo y nombre, `{{2}}` servicios, `{{3}}` vencimiento, `{{4}}` monto total.

## 1. aviso_vencimiento

Botones (respuesta rapida): `Quiero renovar` · `No deseo continuar`

Cuerpo:

```
⏳ *Recordatorio de pago*

{{1}}. Te escribimos solamente para recordarte que el pago de tu suscripción a *{{2}}* está próximo a vencer.

📅 *Fecha de vencimiento:* {{3}}
💵 *Monto:* {{4}}

💳 Puedes realizar tu pago desde antes para asegurar la continuidad del servicio o hacerlo el día de vencimiento.

🕒 Si necesitas más tiempo, notifícanos antes del vencimiento para evitar la desconexión automática.

❌ Si no deseas continuar con el servicio, toca el botón "No deseo continuar" o infórmanos. Si no recibimos respuesta, entenderemos que no deseas seguir y procederemos con la suspensión del acceso y la eliminación del perfil.

¡Gracias por tu confianza y preferirnos!

*— MovieTime PTY*
```

Ejemplos: {{1}} `Buenos días, María` · {{2}} `Netflix y Disney+` · {{3}} `5 de octubre de 2026` · {{4}} `$8.50`

## 2. aviso_vence_hoy

Botones: `Quiero renovar` · `No deseo continuar`

Cuerpo:

```
⚠️ *Recordatorio de renovación*

{{1}}. Hoy vence el pago de tu suscripción a *{{2}}*.

📅 *Fecha de vencimiento:* {{3}}
💵 *Monto:* {{4}}

✅ Si deseas continuar con el servicio, toca "Quiero renovar" y te enviaremos los datos de pago.

❌ Si no deseas continuar, toca "No deseo continuar" o infórmanos.

❗ Si no recibimos ningún tipo de respuesta antes de finalizar el día, entenderemos que no deseas continuar y procederemos con la suspensión del servicio y eliminación del perfil.

¡Gracias por tu confianza y por preferirnos! Quedamos atentos a tu respuesta.

*— MovieTime PTY*
```

Ejemplos: {{1}} `Buenos días, María` · {{2}} `Netflix` · {{3}} `5 de octubre de 2026` · {{4}} `$5.00`

Nota: el Yappy no va en la plantilla; se envia como texto libre (`datos_pago`) al tocar "Quiero renovar".

## 3. aviso_corte

Botones: `Quiero renovar`

Cuerpo:

```
❗ *Corte de servicio*

{{1}}. Debido a que no hemos recibido respuesta de su parte, su acceso a la plataforma de *{{2}}* será suspendido en breve.

📅 *Fecha de vencimiento:* {{3}}
💵 *Monto:* {{4}}

Para continuar disfrutando del servicio, toca "Quiero renovar", realiza el pago correspondiente y envíanos el comprobante. Una vez recibido, reactivaremos tu acceso lo más pronto posible.

¡Gracias por tu confianza y por preferirnos! 😊

*— MovieTime PTY*
```

Ejemplos: {{1}} `Buenas tardes, María` · {{2}} `Netflix` · {{3}} `5 de octubre de 2026` · {{4}} `$5.00`

## 4. acceso_actualizado

Botones: `Recibir mis datos`

Cuerpo (variables: `{{1}}` saludo y nombre, `{{2}}` servicio):

```
🔐 *Acceso actualizado*

{{1}}. Actualizamos los datos de acceso de tu servicio de *{{2}}*.

Toca el botón "Recibir mis datos" y te enviaremos ahora mismo la información vigente por este chat.

*— MovieTime PTY*
```

Ejemplos: {{1}} `Buenos días, María` · {{2}} `Netflix`

## Textos libres nuevos del editor

Se envian por API con la ventana abierta (o por wa.me). Marcadores del editor entre llaves simples.

### datos_pago

```
✅ ¡Gracias por renovar, {nombre_cliente}!

Puedes realizar el pago de *{servicio}* ({monto}) al siguiente Yappy:

💳 *Allan Ordoñez*
📱 *6769-4145*

Una vez realizado, envíanos el comprobante por este chat y confirmaremos tu renovación lo más pronto posible.

*— MovieTime PTY*
```

### despedida

```
{saludo}, {nombre_cliente}. Recibimos tu respuesta y no continuaremos con tu suscripción a *{servicio}*.

Gracias por haber sido parte de MovieTime PTY. Si más adelante quieres volver, aquí estaremos para ayudarte. 😊

*— MovieTime PTY*
```
