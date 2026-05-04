## Objetivo

Mantener un acceso visible al modal de perfiles despues de seleccionar un servicio, sin obligar al usuario a volver a abrir el dropdown.

## Enfoque aprobado

- El campo `Servicio` en `Crear venta` y `Editar venta` conserva su comportamiento de dropdown.
- Cuando ya existe un servicio seleccionado, aparece un boton de vista dentro del mismo campo.
- Ese boton abre el modal de perfiles del servicio seleccionado y no despliega el dropdown.
- Cuando no hay servicio seleccionado, el campo se ve como hasta ahora.

## Validacion

- El boton solo aparece con un servicio seleccionado.
- El boton funciona en crear y editar venta.
- El clic en el boton no abre el dropdown.
