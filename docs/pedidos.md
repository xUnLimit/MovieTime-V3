# Pedidos: contrato de base de datos

La migración `20261003050000_pedidos.sql` agrega pedidos, ítems y cobros sin cambiar
las firmas existentes de ventas ni la UI. Los RPC requieren un usuario activo y
una clave UUID explícita. Lectura: usuarios activos. Escritura directa: revocada,
incluido `service_role`. Confirmaciones Yappy: administradores, igual que la
resolución Yappy existente. Expiración: administrador o `service_role`.

`crear_pedido` recibe un arreglo de ítems (máximo 100), cliente y/o contacto,
canal, moneda, fecha de expiración y tasa de cambio. Contacto no tiene FK ni
requiere crear previamente un tercero. Las renovaciones sí requieren el tercero
propietario de la venta. Nuevas ventas toman precio/ciclo/snapshots del plan;
renovaciones los toman del último período. El descuento es un porcentaje
autorizado por el operador. El total se calcula en SQL, no se acepta del cliente.
Cada ítem puede tener su propio ciclo; debe coincidir con el plan/período elegido.
Los planes del catálogo no tienen moneda: su precio se interpreta en la moneda
del pedido; el operador debe elegir la moneda correcta. Renovaciones exigen que
esa moneda coincida con la del período anterior.

La tasa congelada expresa unidades de moneda original por USD (`total_usd =
total / exchange_rate`). USD exige tasa 1. El precio y los nombres comerciales
quedan congelados incluso si el catálogo cambia antes de confirmar.

`confirmar_pedido` recibe pedido, clave de intención, origen, monto y, para
Yappy, ID del pago detectado. Bloquea pedido y registro Yappy, verifica monto y
moneda, registra el cobro y usa el ledger `rpc_idempotency_keys` del repositorio.
Dos pagos distintos pueden completar el total. Un pago Yappy ya registrado o
descartado no puede reutilizarse, ni resolverse después mediante el flujo de
ventas existente. Un reintento con la misma clave devuelve el mismo ID sin
repetir efectos; usar esa clave para otro pedido falla. Cada cobro adicional debe
tener una clave nueva. El resultado es el ID del pedido; su estado se consulta
por el repositorio, porque puede ser `pago_en_revision`, `pagado` o `entregado`.

Un importe insuficiente deja `pago_en_revision` sin crear ventas. Un sobrepago
confirma y conserva la diferencia en `pedidos.notas`, sin inflar el pago de cada
venta. El historial `pedido_pagos` conserva todo el efectivo recibido.

La aplicación bloquea los servicios por ID en orden estable. Las renovaciones
toman además el mismo advisory lock que `create_venta_payment` y leen el último
vencimiento de cada venta, incluso cuando venció en el pasado. Conservan el ciclo
congelado y suman 1/3/6/12 meses de calendario desde ese vencimiento.

El executor interno llama directamente a los overloads idempotentes de
`create_venta_with_initial_payment` y `create_venta_payment`, con la clave del
ítem. Esos RPC crean períodos y exactamente un `pagos_venta` por ítem. No se
copian sus reglas financieras. El trigger existente
`trg_recalc_perfiles_ocupados` actualiza la ocupación dentro de la transacción y
con bloqueo; incrementar otra vez produciría un doble conteo.

La falta de capacidad o un perfil solicitado ya ocupado marca exclusivamente
ese ítem `sin_stock`; los demás se aplican. Sin perfil solicitado se asigna el
primero libre. Si todos se aplican, el pedido queda `entregado`; con faltantes,
`pagado`. Ese saldo y los ítems sin stock requieren conciliación/entrega posterior:
esta etapa no implementa reintentos de asignación ni reembolsos. Un servicio o
venta cortado, archivado o pausado causa error y rollback completo, incluidos
cobro, ledger y cambios de ítems anteriores.

Solo borradores impagos pueden cancelarse/expirar. Pagos parciales no se
descartan al expirar: permanecen en revisión para conciliación. La expiración
usa `SKIP LOCKED` y no compite con confirmaciones en curso.

El adapter valida con Zod, exige conexión, reutiliza `executeIdempotentRpc` y
valida la respuesta con `assertRpcStringId`. Los errores públicos no incluyen
mensajes SQL. El caso de uso no lee estado global ni emite eventos de UI. Los
tipos de tablas/RPC se añadieron manualmente, sin reemplazar los existentes.

Las pruebas pgTAP están en `supabase/tests/database/pedidos.sql`; requieren un
reset local desde migraciones y `supabase test db` en un trabajo posterior. No
se ejecutan sobre ninguna base remota. La prueba de rollback usa dos servicios
para verificar que la aplicación del primer ítem se deshace al fallar el segundo.
Los bloqueos están presentes en SQL; la carrera entre sesiones requiere además
una prueba concurrente de integración antes del release.

## Carrito del panel

La migracion aditiva `20261004020000_pedidos_panel.sql` mantiene las firmas
anteriores y agrega el overload `confirmar_pedido(p_panel_pedidos jsonb,
p_idempotency_key uuid)`. El caso de uso `createVentasFromCartUseCase` agrupa
los items por moneda y prepara una clave estable para el envio completo y
claves para crear/confirmar cada pedido. Un solo RPC ejecuta `crear_pedido` y
`confirmar_pedido` por grupo dentro de la misma transaccion: un error revierte
pedidos, items, cobros, ventas, periodos, ocupacion y ledger de todas las monedas.
Dos llamadas HTTP independientes no ofrecerian esta garantia.

Cada item nuevo del panel lleva `panel`: `item_id`, `precio`, `total`, `estado`,
`fecha_inicio`, `fecha_fin`, `perfil_nombre`, `codigo`, `notas`, `metodo_pago_id`
y `metodo_pago_nombre`. SQL valida el precio y total contra el descuento y
congela los datos en `pedido_items.panel_snapshot`; el ciclo sigue siendo el
contratado en el plan. Los llamadores anteriores conservan el precio del
catalogo, las fechas calculadas y sus valores por defecto. Las ventas inactivas
conservan su estado y no ocupan perfiles. Los carritos gratuitos crean su pago
inicial de valor cero sin inventar un recibo positivo en `pedido_pagos`.

`pedidos.panel_batch_id` vincula los pedidos por moneda al primer pedido del
carrito. El overload devuelve ese ID y el repositorio consulta pedidos e items
para recuperar todas las ventas resultantes y los faltantes. `sin_stock` sigue
siendo un resultado de entrega pendiente, no un error transaccional: conserva
el cobro y aplica los items disponibles. El operador recibe un aviso por item;
solo las ventas efectivamente creadas producen actividad, eventos y avisos al
cliente. Los pedidos de varias monedas se informan con un aviso al operador.

La sesion del formulario conserva payloads congelados y resultados por clave;
un reintento no repite cobros ni ventas y un envio ya completado no repite el
aviso al cliente. Un fallo de transporte o lectura posterior puede ocurrir
despues del commit: se reintenta con la misma clave, sin cancelar ni compensar
un cobro cuyo resultado es ambiguo. Los errores de actividad, sincronizacion
del metodo del tercero o refresco de consultas se comunican como advertencias
tras el commit. La ocupacion solo se actualiza mediante el trigger SQL.

Las pruebas adicionales de atomicidad y snapshots estan en
`supabase/tests/database/pedidos-panel.sql`. Deben ejecutarse en base local/CI
antes del release, junto con las pruebas existentes y las carreras concurrentes.
