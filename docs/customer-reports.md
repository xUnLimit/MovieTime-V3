# Reportes y recopilación de mensajes

En el editor conecta: pedir detalles (Texto) → esperar la respuesta del cliente → cualquier otra respuesta → acción **Crear reporte de problema**. En el texto configura **Minutos para recopilar mensajes** de 1 a 60. Con 0 se conserva la respuesta inmediata actual. El límite para esperar la primera respuesta es independiente.

La ventana empieza al recibir el primer texto y tiene un plazo fijo. Los siguientes textos que llegan dentro de la ventana se reúnen en orden, sin responder por separado. La cola durable procesa el grupo cuando vence el tiempo, y reintenta con el mismo contenido y la misma clave de envío. El cron de bandeja documentado en `whatsapp-durable-processing.md` debe ejecutarse cada minuto: el procesamiento ocurre en la siguiente ejecución después del plazo, aun sin nuevos mensajes.

Solo `create_report` crea un reporte; pedir códigos, escribir una palabra o pasar a humano por otra razón no lo crea. El reporte conserva la explicación recopilada (hasta 65536 caracteres), el mensaje de origen y el enlace al chat con todos los originales y adjuntos. Reintentar la acción reutiliza el reporte y no cambia su explicación. Tras confirmar, el chat pasa al equipo. La confirmación se edita al seleccionar la acción en el inspector, o en Respuestas → Sistema → Confirmación de reporte. Se guarda en el borrador y se activa al publicar. Las versiones anteriores usan el mensaje original.

En **Reportes**, un administrador ve Abiertos / En atención / Resueltos, abre la explicación, entra al chat y cambia el estado. SQL valida el rol y la versión, audita quién cambió el estado y rechaza actualizaciones obsoletas. RLS y grants impiden lectura a otros roles y creación desde clientes.

Durante atención humana los mensajes se guardan en el historial pero no acumulan trabajo automático. Tomar el chat y devolverlo al bot cierran el trabajo antiguo y las esperas anteriores. Reanudar no vuelve a ejecutar mensajes ni botones recibidos durante la pausa; los nuevos mensajes pueden activar el bot. Los botones conservan su comportamiento actual.

Validación: `whatsapp_human_no_replay.sql` reproduce el fallo previo; `customer_reports_collection.sql` verifica plazo, agregación, idempotencia, handoff y RLS. Los tests de casos de uso, API y UI cubren fallos, versión y paginación. `npm run quality:full` es el gate de terminado; la migración se aplica mediante el proceso de release, sin cambios manuales en producción.
