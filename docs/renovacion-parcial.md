# Selección parcial de renovaciones

La migración `20261004040000_renewal_selection.sql` agrega la fila `global` de
`renovacion_ajustes`. `renovacion_parcial_enabled` inicia en `false`; un administrador
puede editarla, el plazo de selección (1–1440 minutos), la edad máxima del aviso
(1–30 días) y `resumen_template`. Los marcadores son `{{servicios}}`, `{{total}}`
y `{{moneda}}`. RLS restringe la edición y lectura autenticada a administradores;
el lector servidor puede usar service_role exclusivamente para lecturas.

`startRenewalSelection({ noticeId, waId }, deps, savedVariables?)` comprueba aviso
aceptado, antigüedad, teléfono canónico único y propiedad de todas sus ventas.
Devuelve opciones vacías y razones de exclusión. `applySelection` admite toggle,
selectAll, clear, decline y confirm, comprobando nuevamente precio y período.
Decline expresa una elección local; `declineSelected` persiste solamente esas
ventas mediante el mismo `declineVentas` del botón NO_CONTINUAR y notifica al
administrador cuando hubo cambios. Desmarcar una venta no la rechaza.

`renderRenewalSummary` muestra diez servicios por página y totales separados por
moneda. `serializeRenewalSelection(selection, nodeId)` devuelve `awaiting` y
variables compatibles con conversation_state, dentro de 4096 bytes, sin nombres,
precios ni credenciales. `rebuildRenewalSelection` restaura referencias elegibles
usando snapshots nuevos; estado expirado o inválido comienza sin selecciones.
No confirma automáticamente una selección reconstruida tras expirar. Una huella
SHA-256 de los snapshots conserva la confirmación solamente si períodos y precios
siguen iguales; un cambio obliga a confirmar el resumen actualizado.

`createRenewalOrder({ selection }, deps)` requiere confirmación y devuelve un
arreglo de `{ id, total, moneda }`, un pedido por moneda. El importe devuelto es
el congelado por SQL. Cada clave UUID deriva del aviso, moneda, ventas, períodos,
ciclos y precios ordenados. El RPC `crear_pedido_renovacion` valida pertenencia,
servicios y snapshots bajo los locks de renovación, delega a `crear_pedido`,
y vincula `notice_id` dentro de la misma transacción. Un precio/período distinto
rechaza toda esa moneda. Un reintento de un pedido existente devuelve su ID
antes de comprobar expiración de la selección o renovación posterior.

El composition root puede usar `createRenewalSelectionDeps` con un cliente de
lectura, replies, tasa y push inyectados. La escritura usa el adapter de pedidos
autenticado: requiere un operador activo; service_role no tiene EXECUTE en el
nuevo RPC. No se cambian RENOVAR, NO_CONTINUAR ni DATOS, ni se conectan nodos,
webhooks o confirmación de pago. El integrador debe usar una identidad autorizada
para crear pedidos y mostrar la plantilla guardada al renderizar el resumen.

Cada moneda es una transacción independiente: si otra moneda falla, se reintenta
la misma selección para recuperar los pedidos existentes. La selección expiró
significa reconstruir y volver a elegir; el aviso conserva su límite de edad.
Los push siguen la semántica existente: fallo de entrega se registra y no revierte
el rechazo; no hay outbox ni garantía de entrega exactamente una vez.
