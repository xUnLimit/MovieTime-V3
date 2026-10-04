# Automatizaciones: implementación y operación

La implementación amplía el esquema conservado tras la restauración. Las migraciones nuevas son forward-only y mantienen las firmas de los RPC anteriores. No se aplicaron migraciones remotas, commits, push ni despliegues. El inventario remoto de solo lectura está en [automation-base-inventory.md](automation-base-inventory.md).

| Tarea | Implementación |
| --- | --- |
| Atender un chat | Inbox persistente, recuperación por cron, FIFO, lease y versión; tomar/devolver y resolver una revisión invalidan respuestas pendientes |
| Comprar o renovar | Recorrido guiado, identidad propia, selección y confirmación; carrito atómico, reservas con vencimiento y límite por contacto |
| Verificar un pago | Fuente IMAP validada, referencia única, acumulación de pagos, reintentos limitados de correo tardío; el cliente escribe `pago CÓDIGO` y la referencia se concilia contra el ingreso recibido |
| Resolver excepciones | Comandos admin idempotentes para saldo sobrante, crédito/devolución externa confirmada, devolución de principal sin asignar, precio vencido y subconjunto de ítems confirmado |
| Entregar acceso | Ledger recuperable separado del pago; revalidación de venta, destinatario, vigencia, cuenta y política inmediatamente antes del envío; historial protegido |
| Acceso por código | Política por cuenta Netflix con confirmación de rotación; contraseña/PIN ausentes del envío y botón ligado a la venta propia vigente |
| Avisar disponibilidad | Interés y consentimiento separados; pausa/cancelación, disponibilidad real, invitación con vencimiento, entrega idempotente y recuperación con la misma versión del chat |
| Editar recorridos | Automatizaciones reúne recorrido, mensajes y simulador; versión fijada en conversaciones abiertas; navegación conserva filtro, selección y borradores |
| Texto libre | Sin interpretación automática: el texto no reconocido muestra el menú guiado; los comandos y botones del recorrido son la única vía de compra |
| Integrar herramientas | API acotada de eventos, consumidor dedicado, leases, deduplicación y correlación; piloto n8n versionado/desactivado, sin escrituras financieras |

## Preparación del operador

En **Automatizaciones → Conexiones**, preparar el vencimiento y el máximo de reservas. **Permitir nuevas compras por WhatsApp** comienza apagado; pausarlo conserva atención de pedidos existentes, conciliación y entrega. El panel mantiene sus comandos comerciales propios. El interruptor general de automatismos y tomar el chat siguen controlando respuestas y entregas automáticas.

En **Automatizaciones**, seleccionar un recorrido para editar mensajes o probar el resultado en el simulador. La biblioteca global es un acceso secundario y avisa que un mensaje compartido afecta sus usos. El resumen operativo presenta pendientes, revisiones y pedidos del día; el detalle muestra entregas, avisos de stock, reintentos y tiempo de resolución.

En **Automatizaciones → Pedidos**, distinguir recibido, asignado y enviado. La política automática exige todos los ítems. Una resolución parcial necesita seleccionar explícitamente ítems e importes; nunca deriva de omitir una venta. Registrar una devolución exige referencia del movimiento externo ya realizado; el panel no efectúa ni simula una transferencia bancaria. Un cambio de moneda requiere revisión, sin conversión silenciosa.

En una cuenta Netflix, **Acceso por código** requiere confirmar rotación previa. La capacidad existe para el proveedor probado; no se habilitan parsers de otros proveedores sin pruebas. En **Automatizaciones → Interesados**, interés no equivale a consentimiento: revisar destinatario, pausa y disponibilidad antes del aviso. Un timeout de entrega incierta queda en revisión y no se reenvía ciegamente.

## Recuperación y conexiones

Programar el POST protegido descrito en [whatsapp-durable-processing.md](whatsapp-durable-processing.md). El webhook acelera el procesamiento; la recuperación persistente completa trabajo pendiente tras una caída. El cron procesa inbox, entregas y avisos de stock. Una falla de envío no revierte pagos ni períodos. Fuera de la ventana de WhatsApp se requiere la plantilla aprobada correspondiente; sin ella el caso permanece pendiente/revisable.

Las variables opcionales de servidor figuran en `.env.local.example`. Las imágenes de comprobantes no se leen automáticamente: la referencia debe escribirse como `pago CÓDIGO` y se compara con la fuente Yappy autenticada; nunca prueba por sí sola el ingreso.

El piloto externo y sus credenciales/retención se describen en [automation-integrations.md](automation-integrations.md). n8n y otros proveedores requieren conexión y verificación del canal real antes de activarse; no se contrataron servicios durante esta implementación.

## Verificación

Los tests cubren permisos/RLS, contratos anteriores, concurrencia del último perfil, reintentos idempotentes, rollback, pagos/renovaciones, diferencias y devoluciones, entregas y consentimiento. El gate de cobertura clasifica pedidos, comercio y carrito entre los recorridos financieros y exige 90% de líneas/funciones y 80% de ramas. No se bajaron pisos ni se añadieron excepciones.

El checkout de verificación parte de `2ebfed0` y aplica la lista exacta de archivos del trabajo; instala con `npm ci`. Los resultados del gate, reconstrucción e integración se conservan en `reports/automation-*.log` y la lista en `reports/automation-reproducible-files.txt`. Las capturas del prototipo cubren claro/oscuro y escritorio/móvil; los E2E autenticados verifican las rutas nuevas, permisos, retorno y accesibilidad.

La promoción a producción sigue [QA.md](QA.md): jobs CI requeridos, credenciales completas, migraciones verificadas, staged deployment, smoke y promoción explícita. Los resultados locales no sustituyen esa aprobación ni las pruebas autorizadas del canal real.
