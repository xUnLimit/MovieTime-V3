# Idempotencia de operaciones financieras

Las altas de ventas con pago inicial, altas de servicios, renovaciones de ventas,
renovaciones de servicios y reembolsos utilizan las cinco RPC protegidas por
`rpc_idempotency_keys`. La migracion `20260523183000_rpc_idempotency_keys.sql`
ya define el bloqueo transaccional y el resultado por usuario, RPC y clave.
Estos cambios de cliente no requieren una migracion adicional.

## Reintentos

- `createMutationIntent()` pertenece al formulario. Un mismo envio conserva su
  `idempotencyKey`; cambiar los datos produce otra clave. Una nueva operacion
  intencional debe tener una clave distinta, aunque el importe sea igual.
- La clave se propaga hasta Supabase. `executeIdempotentRpc` conserva la clave
  ante errores o respuestas incompletas y comparte solicitudes en curso.
- El diario de solicitudes pendientes guarda solo hashes y UUID en
  `sessionStorage`, no credenciales ni datos del formulario. Sin almacenamiento,
  la proteccion de reintentos sigue disponible en memoria.
- Los formularios no se cierran automaticamente cuando su controlador captura
  un error. Se bloquean los dobles envios y el cierre del dialogo de pago durante
  la solicitud.
- Los lotes esperan todos los resultados. Al reintentar sin cambiar los datos,
  omiten las ventas confirmadas y conservan las claves de las pendientes.

## Errores posteriores al guardado

`afterCommit` distingue los fallos de bitacora, notas, caches y otras acciones
posteriores de un fallo de la transaccion financiera. La interfaz muestra una
advertencia de operacion guardada y pide actualizar la pagina, no repetir el
pago. Esto no garantiza que esas acciones secundarias se hayan completado.

En los reembolsos con clave explicita, la validacion autoritativa de saldo se
realiza en SQL: primero se comprueba si la operacion ya existe y, para una nueva,
se bloquea la venta y se valida el saldo. Un saldo reducido por el primer intento
no impide recuperar el reembolso ya registrado.

## Notificaciones

Renovar un servicio sincroniza exclusivamente sus avisos de servicio/reposo.
No borra los avisos de las ventas asociadas, por lo que sus estados `leida` y
`resaltada` permanecen intactos al volver a sincronizar.

## Alcance y limites

- La identidad explicita del formulario se conserva mientras este permanece
  abierto. No se implemento persistencia de borradores: cerrar/reabrir el
  formulario o recargar la pagina puede crear una nueva identidad. Ante una
  respuesta incierta, reintentar en el mismo formulario; si se abandono,
  comprobar el historial antes de iniciar otra operacion.
- El diario puede recuperar solicitudes sin clave explicita por su contenido
  semantico dentro de la misma sesion de pestaña. No deduplica operaciones
  intencionales distintas entre pestañas/dispositivos.
- Esto cubre las cinco RPC financieras indicadas; no convierte todas las
  escrituras del proyecto ni la bitacora en operaciones exactamente una vez.
- La validacion automatizada usa dobles de la RPC y pruebas de propagacion.
  No se generan pagos ni reembolsos de prueba en la base de produccion.
