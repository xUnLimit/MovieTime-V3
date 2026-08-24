# Acento rojo para Cortar

## Decisión

Se aplicará el color rojo de acción destructiva a `Cortar` en el menú y a la interfaz que abre. Esta opción mantiene una jerarquía clara: naranja queda reservado para Seguimiento y rojo identifica el corte.

Se descartó cambiar solamente el texto del menú porque dejaría el diálogo inconsistente. También se descartó teñir todo el diálogo de rojo porque reduciría legibilidad y daría demasiado peso visual.

## Alcance visual

- En el menú, el icono y el texto de `Cortar` serán rojos.
- En `Cortar venta`, el círculo del icono, las tijeras y el botón de confirmación serán rojos.
- El fondo, los campos, el botón secundario y el badge de estado conservarán su estilo actual.

## Verificación

Las pruebas comprobarán los acentos rojos del menú y del diálogo, además de ejecutar lint focalizado.
