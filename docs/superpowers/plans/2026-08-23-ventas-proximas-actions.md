# Ventas Próximas Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar las acciones de Ventas próximas, agrupar los mensajes normal y de cancelación bajo `Notificar`, y recuperar el seguimiento naranja directo.

**Architecture:** Extraer el menú y el nuevo selector de notificación a componentes enfocados. El controlador conservará la selección de la fila, delegará en las funciones de mensajería existentes y alternará el campo `resaltada` mediante la reacción de caché actual.

**Tech Stack:** Next.js 16, React 19, TypeScript, Radix UI, Tailwind CSS, Vitest y Testing Library.

---

### Task 1: Selector de mensajes de Notificar

**Files:**
- Create: `src/components/notificaciones/ventas-proximas/NotifyVentaDialog.tsx`
- Create: `src/components/notificaciones/ventas-proximas/NotifyVentaDialog.test.tsx`

- [ ] **Step 1: Escribir las pruebas fallidas del selector**

Crear una notificación mínima y comprobar que el diálogo muestra `Aviso de pago` y `Cancelación`, ejecuta solamente la opción elegida y se cierra cuando el callback devuelve `true`:

```tsx
it('sends the selected cancellation message', async () => {
  const onCancelMessage = vi.fn().mockReturnValue(true);
  const onOpenChange = vi.fn();
  const user = userEvent.setup();

  render(
    <NotifyVentaDialog
      notification={notification}
      open
      onOpenChange={onOpenChange}
      onNotify={vi.fn()}
      onCancelMessage={onCancelMessage}
    />,
  );

  await user.click(screen.getByLabelText('Cancelación'));
  await user.click(screen.getByRole('button', { name: 'Continuar' }));
  expect(onCancelMessage).toHaveBeenCalledWith(notification);
  expect(onOpenChange).toHaveBeenCalledWith(false);
});
```

Añadir otro caso donde el callback devuelva `false` y verificar que no se solicite cerrar el diálogo.

- [ ] **Step 2: Ejecutar la prueba y confirmar el fallo**

Run: `npm test -- --run src/components/notificaciones/ventas-proximas/NotifyVentaDialog.test.tsx`

Expected: FAIL porque `NotifyVentaDialog` todavía no existe.

- [ ] **Step 3: Implementar el diálogo mínimo**

Usar `Dialog`, `RadioGroup` y `RadioGroupItem`. Mantener una selección local `'expiration' | 'cancellation'`, mostrar una explicación corta para cada mensaje y ejecutar:

```tsx
const succeeded = action === 'expiration'
  ? await onNotify(notification)
  : await onCancelMessage(notification);

if (succeeded !== false) onOpenChange(false);
```

El botón principal se llamará `Continuar`; al cerrar, restablecer la selección a `expiration`.

- [ ] **Step 4: Ejecutar la prueba y confirmar que pasa**

Run: `npm test -- --run src/components/notificaciones/ventas-proximas/NotifyVentaDialog.test.tsx`

Expected: PASS.

### Task 2: Menú ordenado y seguimiento dinámico

**Files:**
- Create: `src/components/notificaciones/ventas-proximas/VentasProximasActionsMenu.tsx`
- Create: `src/components/notificaciones/ventas-proximas/VentasProximasActionsMenu.test.tsx`
- Modify: `src/components/notificaciones/ventas-proximas/types.ts`

- [ ] **Step 1: Escribir las pruebas fallidas del menú**

Renderizar el menú, abrir `Abrir acciones` y verificar exactamente este texto y orden:

```tsx
expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
  'Notificar',
  'Renovar',
  'Seguimiento',
  'Promesa de pago',
  'Cortar',
  'Ver Cliente',
  'Ver Venta',
  'Ver Servicio',
]);
```

Añadir un caso con `resaltada: true` y `fechaPrometidaPago` para esperar `Quitar seguimiento` y `Editar promesa`. Comprobar también que al pulsar seguimiento se llama `onSeguimiento(notification)`.

- [ ] **Step 2: Ejecutar la prueba y confirmar el fallo**

Run: `npm test -- --run src/components/notificaciones/ventas-proximas/VentasProximasActionsMenu.test.tsx`

Expected: FAIL porque el componente todavía no existe.

- [ ] **Step 3: Implementar el componente del menú**

Crear un componente con las propiedades `notification`, `onNotificar`, `onRenovar`, `onSeguimiento`, `onPaymentPromise` y `onCortar`. Construir los ocho `DropdownMenuItem` en el orden aprobado, usar `Star` o `StarOff` para seguimiento y mantener los enlaces actuales. El disparador tendrá `aria-label="Abrir acciones"`.

Actualizar los tipos compartidos con:

```ts
export type VentaNotificationMessageAction = (
  notif: NotificacionVentaConId,
) => boolean | Promise<boolean>;
```

- [ ] **Step 4: Ejecutar la prueba y confirmar que pasa**

Run: `npm test -- --run src/components/notificaciones/ventas-proximas/VentasProximasActionsMenu.test.tsx`

Expected: PASS.

### Task 3: Conectar diálogo, menú y controlador

**Files:**
- Modify: `src/components/notificaciones/ventas-proximas/VentasProximasTableRow.tsx`
- Modify: `src/components/notificaciones/ventas-proximas/VentasProximasTableContent.tsx`
- Modify: `src/components/notificaciones/VentasProximasTable.tsx`
- Modify: `src/components/notificaciones/ventas-proximas/VentasProximasDialogs.tsx`
- Modify: `src/components/notificaciones/ventas-proximas/useVentasProximasController.ts`
- Create: `src/components/notificaciones/ventas-proximas/VentasProximasTableRow.test.tsx`

- [ ] **Step 1: Escribir la prueba fallida del tono naranja**

Renderizar una fila con `resaltada: true` y una promesa activa. Verificar que la fila contiene `bg-orange-50/50`; así seguimiento siempre será visible incluso cuando la promesa mantenga su badge azul o rojo.

- [ ] **Step 2: Ejecutar la prueba y confirmar el fallo**

Run: `npm test -- --run src/components/notificaciones/ventas-proximas/VentasProximasTableRow.test.tsx`

Expected: FAIL porque actualmente la promesa tiene prioridad sobre el fondo naranja.

- [ ] **Step 3: Integrar el menú extraído**

Reemplazar el bloque `DropdownMenu` de la fila por `VentasProximasActionsMenu`. Renombrar las propiedades a `onOpenNotify`, `onSeguimiento` y `onCortar`, retirar `onCancelar` y `onClearLegacyHighlight`, y propagar las nuevas firmas por `VentasProximasTableContent` y `VentasProximasTable`.

- [ ] **Step 4: Dar prioridad visual al seguimiento**

Calcular el fondo con seguimiento primero:

```ts
const rowToneClass = notif.resaltada
  ? 'bg-orange-50/50 dark:bg-orange-500/5'
  : promiseDisplay
    ? promiseOverdue
      ? 'bg-red-50/70 dark:bg-red-500/10'
      : 'bg-blue-50/70 dark:bg-blue-500/10'
    : '';
```

- [ ] **Step 5: Añadir el estado del selector de Notificar**

En el controlador, crear `notificarDialogOpen` y `handleOpenNotificar`. Cambiar `handleNotificar` y `handleCancelar` para devolver `false` cuando falta una plantilla o ocurre un error y `true` cuando se abre WhatsApp.

Reemplazar `handleClearLegacyHighlight` por:

```ts
const handleSeguimiento = async (notif: NotificacionVentaConId) => {
  const nextHighlighted = !notif.resaltada;
  try {
    await toggleNotificationHighlightedStoreCache(notif.id, nextHighlighted);
    await refreshNotificationCaches();
    toast.success(
      nextHighlighted
        ? 'Notificación resaltada para seguimiento'
        : 'Seguimiento eliminado',
    );
  } catch (error) {
    reportError('VentasProximas', 'Error actualizando seguimiento', error);
    toast.error('No se pudo actualizar el seguimiento');
  }
};
```

- [ ] **Step 6: Montar el nuevo diálogo**

Agregar `NotifyVentaDialog` a `VentasProximasDialogs` con la notificación seleccionada, su estado abierto y los callbacks de mensaje. Mantener sin cambios los diálogos de renovación, promesa y corte.

- [ ] **Step 7: Ejecutar las pruebas focalizadas**

Run: `npm test -- --run src/components/notificaciones/ventas-proximas/NotifyVentaDialog.test.tsx src/components/notificaciones/ventas-proximas/VentasProximasActionsMenu.test.tsx src/components/notificaciones/ventas-proximas/VentasProximasTableRow.test.tsx src/components/notificaciones/ventas-proximas/PaymentPromiseDialog.test.tsx`

Expected: PASS.

### Task 4: Verificación completa

**Files:**
- Verify only: all modified files

- [ ] **Step 1: Ejecutar lint**

Run: `npm run lint`

Expected: PASS sin errores nuevos.

- [ ] **Step 2: Ejecutar la suite**

Run: `npm test -- --run`

Expected: PASS.

- [ ] **Step 3: Compilar producción**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Validar migraciones**

Run: `npm run migrate:validate`

Expected: PASS.

- [ ] **Step 5: Revisar visualmente**

Abrir Ventas próximas, comprobar el orden del menú, ambas rutas de `Notificar`, el cambio entre `Seguimiento` y `Quitar seguimiento`, la posición de la promesa y que `Cortar` solo pida el motivo.

No crear commit ni hacer push salvo solicitud explícita del usuario.
