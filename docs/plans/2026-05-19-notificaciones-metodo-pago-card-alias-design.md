# Notificaciones: alias y terminacion de tarjeta en servicios

## Objetivo

En `/notificaciones`, los tabs de servicios proximos y servicios autorrenovables deben mostrar mas contexto del metodo de pago asociado.

## Diseno aprobado

La columna `Metodo de Pago` renderiza:

```txt
Nombre del metodo
Alias •••• 1234
```

Si no existe alias, muestra solo `•••• 1234`. Si no existe terminacion, conserva solo el nombre del metodo.

## Datos

Las notificaciones de servicio guardan snapshots de `metodo_pago_alias_snapshot` y `metodo_pago_tarjeta_terminacion_snapshot`. La vista `v_notificaciones_servicio` prefiere los datos vivos del metodo de pago asociado al servicio y usa los snapshots como respaldo.

## UI

`ServiciosProximosTableRow` muestra el nombre del metodo arriba y el alias/terminacion debajo en texto secundario. Ambos tabs comparten el mismo componente, asi que el cambio aplica a servicios proximos y autorrenovables.
