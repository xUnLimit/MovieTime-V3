# Notificacion de credenciales de servicio por WhatsApp

## Objetivo

Cuando se edita un servicio y cambia el correo, la contrasena o ambos, el sistema debe permitir notificar a todos los clientes con ventas activas asociadas a ese servicio.

## Diseno aprobado

- Agregar un nuevo tipo de plantilla: `actualizacion_credenciales`.
- Mostrar esa plantilla en el editor de mensajes para que pueda personalizarse.
- Detectar cambios de `correo` y `contrasena` en `ServicioEditForm`.
- Despues de guardar el servicio, consultar las ventas activas del servicio editado.
- Generar un mensaje por cliente usando la plantilla y los datos nuevos del servicio.
- Guardar los mensajes en una cola de WhatsApp para enviarlos uno por uno desde un toast persistente.
- Si una venta no tiene telefono, mantenerla visible como pendiente sin bloquear el resto.

## Datos usados

Cada mensaje usa el cliente, servicio, categoria, perfil, codigo, correo y contrasena disponibles en la venta y en el servicio actualizado.

## Manejo de errores

El guardado del servicio es la operacion principal. Si falla la preparacion de mensajes, se muestra una advertencia pero no se revierte el servicio guardado.

