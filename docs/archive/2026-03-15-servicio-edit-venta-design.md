## Objetivo

Igualar el campo `Servicio` de `Editar venta` con el comportamiento ya existente en `Crear venta`, porque en edicion faltaban dos piezas visibles para el usuario: el indicador de disponibilidad y el boton para ver las personas/perfiles ocupados del servicio.

## Enfoque aprobado

Se replica en `VentasEditForm` el dropdown enriquecido del selector de servicios:

- mostrar disponibilidad por servicio dentro de cada opcion,
- incluir el icono para abrir el detalle de perfiles,
- mantener la seleccion normal del servicio al hacer clic en la fila,
- separar el clic del icono para que solo abra el detalle,
- conservar el servicio actual de la venta aunque este lleno o inactivo.

## Alcance

El cambio queda limitado a `Editar venta`. `Crear venta` ya tenia este comportamiento y solo se toma como referencia funcional. No se hace una extraccion de componentes compartidos en esta pasada para no aumentar el riesgo del ajuste.

## Datos y comportamiento

- La disponibilidad del dropdown usa los datos del servicio y compensa la ocupacion de la venta actual cuando sigue sobre el mismo servicio.
- El modal de detalle consulta las ventas activas del servicio y excluye la venta que se esta editando.
- Si en el formulario ya hay un perfil seleccionado para ese servicio, el modal lo muestra como `Pendiente` mientras no se guarde la edicion.

## Validacion

- Verificar que el dropdown de `Servicio` en `Editar venta` muestre cantidad disponible.
- Verificar que el icono abra el modal sin seleccionar accidentalmente el servicio.
- Verificar que `npm run build` siga pasando.
