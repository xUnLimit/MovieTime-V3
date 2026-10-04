# Conversaciones y recuperación

El webhook valida firma y estructura y persiste la entrada. Un trigger encola el
trabajo en la misma transacción. `after()` acelera el procesamiento; la cola en
Postgres permite recuperarlo aunque la instancia termine antes de ejecutar esa
función. La cola histórica desactivada por la restauración continúa inactiva.

La identidad usa `terceros.wa_id`, la columna generada retenida por la restauración,
y un índice parcial para terceros activos. Un teléfono compartido no autoriza
acceso automático a una venta. Las ventas para acceso requieren vigencia y una
cuenta activa sin reposo, corte o archivo.

Cada conversación tiene un único trabajo activo, lease de 90 segundos y versión
de fencing. Los mensajes posteriores esperan al anterior, incluso durante el
backoff. Se guardan selección y respuesta comercial antes de enviarla. Los efectos
comerciales y los mensajes usan claves deterministas; reentregar una entrada no
vuelve a crear un pedido ni a cobrar.

Tomar el chat invalida el lease. El servidor lo comprueba después de leer
plantillas y justo antes de iniciar la llamada externa. Una llamada ya iniciada
puede finalizar; ninguna API puede retirar un mensaje que el proveedor ya aceptó.
Una entrega de resultado incierto pasa a revisión: se verifica el historial y se
responde manualmente, se marca el caso atendido, y solo entonces se devuelve al
bot. La resolución guarda administrador y hora. No se reenvía automáticamente un
mensaje incierto ni se revierte un pago correcto.

## Preparación

- Configurar `WHATSAPP_INBOX_CRON_SECRET` con al menos 32 caracteres aleatorios.
  Mantenerlo únicamente en el entorno del servidor y del scheduler.
- Programar cada minuto `POST /api/whatsapp/inbox/cron`, con
  `Authorization: Bearer <secreto>`, sobre el despliegue aprobado. El endpoint
  consume hasta diez trabajos. Un administrador también puede ejecutar
  `POST /api/whatsapp/inbox/process` para recuperación inmediata.
- Definir `YAPPY_PAYMENT_INSTRUCTIONS` como instrucciones comerciales verificadas
  (hasta 600 caracteres). Sin ellas, solicitar instrucciones deriva al operador;
  el sistema no inventa un destinatario de pago.
- Activar y publicar el recorrido en Automatizaciones. Las conversaciones fijan
  su versión; una publicación posterior no cambia sus acciones en curso.

La configuración y la programación de estos servicios se realizan al desplegar;
este cambio no activa un scheduler remoto ni modifica producción.

## Recorridos guiados

`catálogo`, `renovar`, `mis servicios`, `carrito`, `confirmar`, `estado`, `cancelar`
y `ayuda` funcionan sin IA. El catálogo pagina disponibles y agotados. La selección
admite diez servicios y una moneda por pedido. El resumen necesita confirmación
explícita; el RPC compara el total esperado bajo bloqueo antes de reservar. Los
servicios agotados solicitan consentimiento de aviso separado del registro de
interés.

`pago CÓDIGO` presenta una referencia candidata al conciliador. Ni un comprobante
ni el texto del cliente confirman el ingreso. Pago recibido, asignación y envío de
acceso se muestran por separado. Un correo tardío conserva trabajo persistente
en el conciliador de pedidos. Los importes menores y mayores nunca se ocultan.

Las acciones editables `purchase`, `renewal` y `my_services` usan estos mismos
recorridos y cuentan con previsualización en el simulador. La IA puede sugerir
catálogo, servicios propios, estado o atención humana; sus argumentos nunca
seleccionan automáticamente una venta, un pedido o una operación de dinero.

Una imagen se lee únicamente durante el pago de un pedido propio confirmado y
cuando está habilitada la interpretación. Una referencia candidata se devuelve
para confirmación escrita con `pago CÓDIGO`; nunca concilia por sí sola. El
checkpoint conserva la respuesta para no volver a leer la imagen en un reintento.

## Entrega de acceso

La asignación encola un trabajo por ítem aplicado en `mt_order_deliveries`. El
worker comparte el lease de la conversación, verifica de nuevo propiedad,
vigencia, cuenta y política inmediatamente antes de llamar a Meta y usa una
clave estable por ítem. El ledger conserva identificadores, intentos y resultado;
el historial conserva texto protegido. Las credenciales existen solo durante el
envío y nunca entran en la cola, el contexto conversacional o la IA. En modo
código se omiten contraseña y PIN y se ofrece un botón vinculado a la venta.

El cron y la conciliación drenan la cola. Automático apagado bloquea este envío;
un administrador puede pedirlo expresamente desde el pedido mediante
`POST /api/whatsapp/orders/deliver`. Solo un mensaje aceptado por Meta con la
clave del mismo ítem permite marcar su entrega. El pedido indica enviado cuando
todos los ítems aplicados se entregaron y no quedan pendientes. Una resolución
parcial permite enviar su subset y mantiene visibles los pendientes.

Fuera de la ventana de 24 horas, el acceso de texto o botones queda pendiente:
la recuperación necesita que el cliente abra la conversación. Un rechazo
explícito admite backoff y hasta cinco intentos; un resultado incierto requiere
verificar el historial y no se reenvía por el botón de reintento. Una interrupción
de entrega nunca repite cobros ni revierte dinero o ventas correctas.

## Avisos de disponibilidad

La recuperación también procesa hasta diez intereses consentidos por pasada
cuando hay stock apto, descontando reservas vigentes. Los avisos automáticos
respetan pausa, estado de interés, cuenta y plan activos, control humano y el
interruptor global. El aviso manual usa el mismo lease y la misma clave de envío
por interés. Una aceptación real establece la invitación por treinta minutos;
no reserva ni garantiza un perfil para ese destinatario.

Configurar `AUTOMATION_INTEREST_TEMPLATE` con una plantilla aprobada en español
y un parámetro (nombre de la categoría) para avisar fuera de la ventana de
atención. Sin esa plantilla, la ventana cerrada conserva el trabajo para
recuperación. La cola aplica backoff, hasta cinco intentos y revisión ante una
entrega incierta. Un aviso no consentido, pausado o ya aceptado no se reenvía.

## Comprobaciones

`supabase/tests/database/whatsapp_automation_inbox.sql` verifica deduplicación,
orden, leases, takeover, versión del operador, backoff, revisión y auditoría de
resolución. Las pruebas de aplicación cubren selección propia, confirmación,
referencias explícitas, estados financieros/entrega, consentimiento y recuperación
del mensaje interactivo. Los gates finales siguen siendo los de `AGENTS.md`.
`supabase/tests/database/automation_order_delivery.sql` comprueba autorización,
fencing, política de código, aceptación por ítem, recuperación y entregas parciales.
