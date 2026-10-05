# Plantillas de WhatsApp (para ajustar)

Edita los textos directamente en este archivo y avisa cuando termines.

Hay dos clases de plantillas:

- **A. Plantillas de Meta.** Se envían por la API aunque el cliente no haya escrito, y necesitan aprobación de Meta. Las variables son numeradas (`{{1}}`, `{{2}}`…) y cada una ocupa una sola línea.
- **B. Textos libres del apartado Plantillas de mensajes.** Se envían por wa.me, o por la API cuando el chat está abierto. Se editan en la app sin aprobación y usan variables con nombre, como `{nombre_cliente}`.

---

## A. Plantillas de Meta (2)

### A1. `recordatorio_pago`

Categoría Utilidad, idioma Spanish (es).

Se usa para "Notificación regular", "Día de pago" y "Cancelación", y también en el envío automático del día de vencimiento.

| Variable | Dato | Ejemplo |
|---|---|---|
| `{{1}}` | Saludo y nombre | Buenos días, María |
| `{{2}}` | Servicios | Netflix y Disney+ |
| `{{3}}` | Fecha de vencimiento | 5 de octubre de 2026 |
| `{{4}}` | Monto total | $9.50 |

```
⏳ *Recordatorio de pago*

{{1}}. Te escribimos solamente para recordarte que el pago de tu suscripción a *{{2}}* está por finalizar.

📅 *Fecha de vencimiento:* {{3}}
💵 *Monto:* {{4}}

Si no recibimos respuesta, procederemos con la suspensión del servicio.

¡Gracias por tu confianza y por preferirnos!

*— MovieTime PTY*
```

Botones de respuesta rápida: `Continuar` · `No continuar` (Meta no permite emojis en botones)

Así le llega al cliente:

> ⏳ *Recordatorio de pago*
> Buenos días, María. Te recordamos que tu suscripción a *Netflix y Disney+* vence el 5 de octubre de 2026.
> 💵 *Monto:* $9.50
> …
> [Continuar] [No continuar]

### A2. `acceso_actualizado`

Categoría Utilidad, idioma Spanish (es).

Se usa cuando cambian las credenciales o se transfiere un servicio. No lleva contraseñas: el cliente las recibe al tocar el botón.

| Variable | Dato | Ejemplo |
|---|---|---|
| `{{1}}` | Saludo y nombre | Buenos días, María |
| `{{2}}` | Servicio | Netflix |

```
🔐 *Acceso actualizado*

{{1}}. Actualizamos los datos de acceso de tu servicio de *{{2}}*.

Toca el botón "Recibir mis datos" y te enviaremos ahora mismo la información.

*— MovieTime PTY*
```

Botón de respuesta rápida: `Recibir mis datos`

---

## B. Textos libres del apartado Plantillas de mensajes

Variables disponibles:

- Datos del cliente: `{saludo}`, `{nombre_cliente}`, `{cliente}`
- Datos del servicio: `{categoria}`, `{servicio}`, `{vencimiento}`, `{monto}`
- Credenciales: `{correo}`, `{contrasena}`, `{perfil_nombre}`, `{codigo}`
- Varias ventas: `{items}` y el bloque `{{#items}}…{{/items}}`, que se repite por cada venta

### B1. Notificación regular

Es el respaldo por wa.me de A1, para antes del vencimiento.

```
⏳ *Recordatorio de pago*

{saludo}, {nombre_cliente}. Te escribimos solamente para recordarte que el pago de tu suscripción a *{categoria}* está próximo a vencer.

📅 *Fecha de vencimiento:* {vencimiento}
💵 *Monto:* {monto}

💳 Puedes realizar tu pago desde antes para asegurar la continuidad del servicio o hacerlo el día de vencimiento.

🕒 Si necesitas más tiempo, notifícanos antes del vencimiento para evitar la desconexión automática.

❌ Si no deseas continuar con el servicio, por favor infórmanos. Si no recibimos respuesta, entenderemos que no deseas seguir y procederemos con la suspensión del acceso y la eliminación del perfil.

¡Gracias por tu confianza y preferirnos! ✨

*— MovieTime PTY*
```

### B2. Día de pago

Es el respaldo por wa.me de A1, para el día del vencimiento.

```
⚠️ *Recordatorio de renovación - {categoria}*

📅 *Fecha de vencimiento:* {vencimiento}
💵 *Monto:* {monto}

❌ Si no deseas continuar con el servicio, por favor infórmanos.

✅ Si deseas continuar con el servicio, puedes realizar el pago al siguiente Yappy:
Allan Ordoñez
6769-4145

❗ Si no recibimos ningún tipo de respuesta antes de finalizar el día, entenderemos que no deseas continuar y procederemos con la suspensión del servicio y eliminación del perfil.

¡Gracias por tu confianza y por preferirnos! Quedamos atentos a tu respuesta 😊

*— MovieTime PTY*
```

### B3. Cancelación

Es el respaldo por wa.me de A1, para después del vencimiento.

```
❗*Corte de servicio*

{saludo}, {nombre_cliente}. debido a que no hemos recibido respuesta de su parte, su acceso a la plataforma de *{categoria}* será suspendido en breve.

📅 *Fecha de vencimiento:* {vencimiento}
💵 *Monto:* {monto}

Para continuar disfrutando del servicio, te invitamos a realizar el pago correspondiente y enviarnos el comprobante. Una vez recibido, reactivaremos tu acceso lo más pronto posible.

¡Gracias por tu confianza y por preferirnos! 😊

*— MovieTime PTY*
```

### B4. Datos de pago (nuevo)

Se envía automáticamente cuando el cliente toca "Continuar".

```
✅ ¡Gracias por renovar, {nombre_cliente}!

Puedes realizar el pago de *{servicio}* ({monto}) al siguiente Yappy:

💳 *Allan Ordoñez*
📱 *6769-4145*

Una vez realizado, envíanos el comprobante por este chat y confirmaremos tu renovación lo más pronto posible.

*— MovieTime PTY*
```

### B5. Despedida (nuevo)

Se envía automáticamente cuando el cliente toca "No continuar".

```
{saludo}, {nombre_cliente}. Recibimos tu respuesta y no continuaremos con tu suscripción a *{servicio}*.

Gracias por haber sido parte de MovieTime PTY. Si más adelante quieres volver, aquí estaremos para ayudarte. 😊

*— MovieTime PTY*
```

### B6. Renovación

Se envía después de registrar el pago de una renovación.

```
🎉 *¡Renovación exitosa!*

Tu suscripción a *{categoria}* ha sido renovada con éxito.

📅 *Nueva fecha de vencimiento:* {vencimiento}

❓ Si tienes alguna duda o necesitas asistencia, no dudes en escribirnos. ¡Estamos para ayudarte!

¡Gracias por seguir confiando en nosotros! ✨

*— MovieTime PTY*
```

### B7. Suscripción

Se envía al crear una venta.

```
🎉 *¡Suscripción activada con éxito!*

Te confirmamos que tu suscripción a {items} ha sido activada correctamente. A continuación, te compartimos los datos de acceso:

{{#items}}
> {categoria}
📅 *Fecha de vencimiento:* {vencimiento}
📧 *Correo:* {correo}
🔑 *Contraseña:* {contrasena}
👤 *Perfil:* {perfil_nombre}
🔒 *PIN:* {codigo}
{{/items}}

❓ Si tienes alguna pregunta o necesitas asistencia, no dudes en avisarnos. Estamos aquí para ayudarte.

📸 Luego de ingresar y verificar si todo funciona correctamente, por favor compártenos una captura, si es posible.

¡Gracias por confiar en nosotros! ✨

*— MovieTime PTY*
```

### B8. Actualización de credenciales

Se envía por wa.me, o cuando el cliente toca "Recibir mis datos" en A2.

```
❗*Actualización de Datos - {categoria}*

{saludo}, {nombre_cliente}. Queremos informarle que, debido a que un cliente ha decidido no continuar con el servicio, hemos realizado ciertos cambios que restringen su acceso.

> {categoria}
📧 *Correo:* {correo}
🔑 *Contraseña:* {contrasena}
👤 *Perfil:* {perfil_nombre}
🔒 *PIN:* {codigo}

La cuenta sigue siendo la misma, con sus perfiles intactos. Esta acción fue únicamente para retirar el acceso del cliente.

¡Gracias por su confianza y por preferirnos! Agradecemos mucho su comprensión 😊

*— MovieTime PTY*
```

### B9. Transferencia de servicio

Se envía por wa.me, o cuando el cliente toca "Recibir mis datos" en A2.

```
❗*Actualización de Datos - {categoria}*

> {categoria}
📧 *Correo:* {correo}
🔑 *Contraseña:* {contrasena}
👤 *Perfil:* {perfil_nombre}
🔒 *PIN:* {codigo}

¡Gracias por su confianza y por preferirnos! 😊

*— MovieTime PTY*
```
