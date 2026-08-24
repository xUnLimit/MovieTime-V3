# Servicios: seguimiento directo e inactivación dedicada

> **For Codex:** Implement this plan task-by-task, preserving unrelated working-tree changes and using test-driven development.

**Goal:** Mover la acción de seguimiento al menú principal de cada servicio y dejar “Inactivar” como una confirmación dedicada.

**Architecture:** La fila del servicio expondrá una nueva acción `onSeguimiento` que alterna `resaltada` directamente mediante el controlador. El diálogo existente conservará únicamente la confirmación de inactivación. La tabla y el contenedor sólo propagarán los callbacks necesarios.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, Radix Dropdown Menu, Tailwind CSS.

---

## Task 1: Especificar el menú directo de Servicios

**Files:**
- Create: `src/components/notificaciones/servicios-proximos/ServiciosProximosTableRow.test.tsx`
- Modify: `src/components/notificaciones/servicios-proximos/ServiciosProximosTableRow.tsx`
- Modify: `src/components/notificaciones/servicios-proximos/ServiciosProximosTableContent.tsx`
- Modify: `src/components/notificaciones/ServiciosProximosTable.tsx`

1. Crear una prueba que abra el menú de una fila y verifique el orden `Renovar`, `Seguimiento`, `Inactivar`, `Ver Servicio`.
2. Añadir el caso resaltado y comprobar que muestra `Quitar seguimiento` y llama `onSeguimiento` con la notificación.
3. Ejecutar la prueba y confirmar que falla porque la nueva propiedad y acción todavía no existen.
4. Añadir `onSeguimiento`, el elemento naranja con icono de estrella y la etiqueta accesible del disparador.
5. Propagar el callback por el contenido y la tabla.
6. Ejecutar la prueba y confirmar que pasa.

## Task 2: Convertir el diálogo en una confirmación exclusiva de inactivación

**Files:**
- Create: `src/components/notificaciones/AccionesServicioDialog.test.tsx`
- Modify: `src/components/notificaciones/AccionesServicioDialog.tsx`
- Modify: `src/components/notificaciones/servicios-proximos/ServiciosProximosDialogs.tsx`

1. Crear una prueba que abra el diálogo y verifique que no ofrece `Resaltar` ni `Descartar`, y que confirma mediante el botón rojo `Inactivar`.
2. Ejecutar la prueba y confirmar que falla con el diálogo actual de acciones múltiples.
3. Eliminar el selector de acciones y conservar información del servicio, advertencia destructiva, estados de envío y cierre seguro.
4. Retirar `onResaltar` y `onDescartar` de las propiedades del diálogo contenedor.
5. Ejecutar la prueba y confirmar que pasa.

## Task 3: Implementar la alternancia directa de seguimiento

**Files:**
- Modify: `src/components/notificaciones/servicios-proximos/useServiciosProximosController.ts`
- Modify: `src/components/notificaciones/ServiciosProximosTable.tsx`

1. Sustituir los handlers dependientes del diálogo por `handleSeguimiento(notif)`.
2. Alternar `notif.resaltada` en la caché persistida, refrescar las cachés y mostrar mensajes distintos al activar o quitar seguimiento.
3. Conectar el handler con la fila y eliminar las propiedades antiguas del diálogo.
4. Ejecutar las pruebas enfocadas.

## Task 4: Validación integral

**Files:**
- Verify all changed files.

1. Ejecutar ESLint sobre los archivos modificados.
2. Ejecutar la suite completa de Vitest.
3. Ejecutar el build de producción.
4. Revisar el diff para asegurar el orden, colores, textos y que no haya cambios ajenos al alcance.

