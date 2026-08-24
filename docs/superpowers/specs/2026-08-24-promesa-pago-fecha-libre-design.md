# Promesa de pago con fecha libre

## Objetivo

Permitir que una promesa de pago use cualquier fecha válida: pasada, actual o futura.

## Comportamiento

- Una promesa nueva seguirá mostrando mañana como fecha predeterminada.
- El calendario permitirá seleccionar cualquier día sin límite mínimo ni máximo.
- El guardado aceptará fechas pasadas, la fecha actual y fechas futuras.
- Una promesa existente conservará su fecha al abrirse, incluso si ya pasó.
- El campo seguirá requiriendo una fecha válida.
- Las promesas cuya fecha ya pasó conservarán la presentación actual de promesa vencida.

## Cambios técnicos

- Retirar del calendario la regla que deshabilita fechas anteriores a mañana.
- Cambiar la validación de promesa para comprobar únicamente que el valor sea una fecha válida.
- Sustituir el texto que exige una fecha futura por una indicación de selección libre.
- Mantener `getPanamaTomorrow()` exclusivamente para calcular el valor predeterminado.

## Manejo de errores

- Si la fecha no existe o no es válida, no se enviará el formulario.
- Los errores al guardar seguirán siendo gestionados por el controlador y el diálogo permanecerá abierto para reintentar.

## Pruebas

- Una promesa nueva usa mañana como valor inicial.
- Una fecha pasada puede seleccionarse y guardarse.
- La fecha actual puede seleccionarse y guardarse.
- Una fecha futura puede seleccionarse y guardarse.
- Una promesa vencida existente puede guardarse sin exigir una nueva fecha futura.

