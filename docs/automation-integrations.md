# Piloto externo de demanda

El workflow versionado `integrations/n8n/demand-summary.workflow.json` está desactivado. MovieTime sigue atendiendo pedidos si n8n está detenido. El consumidor `demand-summary` obtiene hasta 25 eventos por consulta, con lease de cinco minutos y límite de 60 llamadas/minuto. No dispone de operaciones financieras ni acceso directo a Supabase.

Importar el JSON y configurar variables `MOVIETIME_URL` (origen HTTPS de MovieTime) y `DEMAND_TARGET_URL` (endpoint HTTPS del receptor elegido). Crear dos credenciales **Header Auth**: MovieTime con `Authorization: Bearer <AUTOMATION_INTEGRATION_TOKEN>` y otra credencial propia del receptor. Asignar la primera a Obtener eventos/Confirmar recepción y la segunda a Enviar resumen. Nunca exportar las credenciales. El token se genera y conserva en el gestor de secretos del despliegue; no es una clave Supabase.

El receptor debe aceptar `Idempotency-Key` igual al ID del evento y devolver éxito solo después de persistirlo. La entrega contiene ID, versión, correlación, tipo, agregado, fecha y datos permitidos; excluye contacto, secretos y token del lease. Tras el éxito se confirma la recepción. Un timeout no confirma el evento: vuelve a estar disponible tras expirar su lease. Deduplicar en el receptor evita repetir efectos si este persistió antes del timeout. Los eventos de este consumidor no modifican el procesamiento interno de MovieTime.

El export limita los tipos a pedido confirmado/pagado/asignado, cambio de modo de acceso y demanda registrada. Las ejecuciones exitosas, fallidas y manuales no guardan datos; no fijar datos de producción en los nodos. Cada HTTP tiene timeout de 12 segundos, tres intentos y redirecciones desactivadas; el workflow termina a los 240 segundos. Los errores se supervisan por estado y fecha de ejecución, sin conservar payloads.

Las pruebas del contrato del workflow y de la API usan dobles; los tests SQL verifican leases, autorizaciones, campos exportados y confirmación. La importación/ejecución en una instancia n8n y el receptor real se validan antes de activar el piloto: éxito, duplicado, timeout y recuperación, interrupción del receptor y credenciales inválidas. No se ha contratado ni desplegado n8n.

Referencias: [HTTP Request](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/) y [credenciales HTTP](https://docs.n8n.io/integrations/builtin/credentials/httprequest/).
