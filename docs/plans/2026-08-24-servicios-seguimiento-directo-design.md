# Seguimiento directo en Servicios próximos

## Objetivo

Separar Seguimiento de la acción Inactivar en las notificaciones de Servicios, replicando el patrón aprobado para Ventas próximas.

## Menú acordado

1. Renovar
2. Seguimiento o Quitar seguimiento
3. Inactivar
4. Ver Servicio

## Comportamiento

- `Seguimiento` resaltará directamente la fila en naranja.
- En una fila resaltada, la misma posición mostrará `Quitar seguimiento` y eliminará el naranja.
- `Inactivar` abrirá un diálogo dedicado únicamente a confirmar la inactivación del servicio.
- El diálogo dejará de incluir Resaltar y Descartar resaltado.
- Renovar y Ver Servicio conservarán su comportamiento actual.

## Flujo

La fila enviará la notificación completa al controlador cuando se pulse Seguimiento. El controlador alternará `resaltada` mediante la reacción de caché existente. La selección usada por el diálogo se reservará para Inactivar.

## Verificación

Las pruebas cubrirán el orden del menú, las etiquetas dinámicas de seguimiento, el callback directo y la ausencia de opciones de resaltado dentro del diálogo de inactivación.
