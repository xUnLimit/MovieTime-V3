# Reorganización de acciones en Ventas próximas

## Objetivo

Reordenar el menú de acciones de cada notificación de venta y recuperar el acceso directo al seguimiento naranja que se perdió al separar el flujo de corte durante la implementación de promesas de pago.

## Menú acordado

Las acciones se mostrarán en este orden:

1. Notificar
2. Renovar
3. Seguimiento o Quitar seguimiento
4. Promesa de pago o Editar promesa
5. Cortar
6. Ver Cliente
7. Ver Venta
8. Ver Servicio

La acción independiente `Cancelar` desaparece del menú principal.

## Comportamiento

### Notificar

Al seleccionar `Notificar`, se abrirá un diálogo que pedirá elegir entre:

- enviar la notificación regular o de día de pago que corresponda por la fecha de vencimiento;
- enviar la notificación de cancelación.

La generación y apertura del mensaje de WhatsApp seguirá utilizando las plantillas y funciones existentes. Si falta la plantilla seleccionada, el diálogo permanecerá disponible y se mostrará el error actual.

### Seguimiento

Esta acción no abrirá el diálogo de corte. En una fila sin resaltar, `Seguimiento` marcará la notificación como resaltada y la fila se verá naranja. En una fila ya resaltada, la misma posición mostrará `Quitar seguimiento` y eliminará el resaltado.

Cuando el seguimiento esté activo, el fondo naranja tendrá prioridad incluso si también existe una promesa de pago. El estado y el icono de la promesa conservarán su información azul o roja dentro de la fila.

### Promesa de pago

El flujo existente no cambia. La etiqueta será `Promesa de pago` cuando no exista una fecha prometida y `Editar promesa` cuando ya exista. La acción queda situada entre seguimiento y corte.

### Cortar

`Cortar` abrirá únicamente el formulario existente para indicar el motivo y ejecutar el corte. Ya no ofrecerá una alternativa para resaltar.

## Componentes y flujo de datos

- La fila de `VentasProximasTableRow` definirá el orden y las etiquetas dinámicas del menú.
- Un diálogo de selección de mensaje recibirá la notificación elegida y delegará al controlador la notificación regular o la cancelación.
- El controlador conservará las funciones actuales de generación de WhatsApp y expondrá una acción explícita para activar o quitar seguimiento.
- Los flujos de renovación, promesa, corte y navegación conservarán sus implementaciones actuales.

## Verificación

Se cubrirá con pruebas el orden del menú, la ausencia de `Cancelar` como acción principal, las dos opciones del diálogo de `Notificar`, la activación y eliminación directa del seguimiento, y la conservación del flujo de promesa. Después se ejecutarán las comprobaciones del proyecto y una revisión visual del menú y los diálogos.
