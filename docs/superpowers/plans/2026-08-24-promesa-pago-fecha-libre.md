# Promesa de pago con fecha libre Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir guardar promesas de pago con cualquier fecha válida, manteniendo mañana como valor predeterminado.

**Architecture:** La regla de validez dejará de comparar la fecha con mañana y comprobará únicamente que sea una instancia válida de `Date`. El diálogo reutilizará mañana sólo como valor inicial y expondrá todo el calendario sin días deshabilitados.

**Tech Stack:** React, TypeScript, date-fns, react-day-picker, Vitest, Testing Library.

---

### Task 1: Especificar fechas libres en el diálogo

**Files:**
- Modify: `src/components/notificaciones/ventas-proximas/PaymentPromiseDialog.test.tsx`
- Modify: `src/components/notificaciones/ventas-proximas/PaymentPromiseDialog.expired.test.tsx`
- Test: `src/components/notificaciones/ventas-proximas/PaymentPromiseDialog.test.tsx`
- Test: `src/components/notificaciones/ventas-proximas/PaymentPromiseDialog.expired.test.tsx`

- [ ] **Step 1: Escribir pruebas que seleccionen y guarden hoy y una fecha pasada**

Abrir el calendario con Testing Library, seleccionar los botones accesibles de los días y comprobar que `onSave` recibe `new Date(2026, 7, 23)` para hoy y `new Date(2026, 7, 20)` para una fecha pasada.

- [ ] **Step 2: Cambiar la prueba de promesa vencida**

Reemplazar la expectativa de botón deshabilitado por:

```tsx
expect(
  (screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement)
    .disabled,
).toBe(false);
```

- [ ] **Step 3: Ejecutar las pruebas y confirmar RED**

Run:

```bash
npm test -- --run src/components/notificaciones/ventas-proximas/PaymentPromiseDialog.test.tsx src/components/notificaciones/ventas-proximas/PaymentPromiseDialog.expired.test.tsx
```

Expected: FAIL porque las fechas anteriores a mañana siguen deshabilitadas y una promesa vencida no puede guardarse.

### Task 2: Retirar la restricción de fecha futura

**Files:**
- Modify: `src/application/use-cases/notificaciones/payment-promise.ts`
- Modify: `src/components/notificaciones/ventas-proximas/PaymentPromiseDialog.tsx`
- Test: `src/application/use-cases/notificaciones/payment-promise.test.ts`

- [ ] **Step 1: Cambiar el validador a fecha válida**

Implementar:

```ts
export function isValidPaymentPromiseDate(date: Date): boolean {
  return date instanceof Date && !Number.isNaN(date.getTime());
}
```

- [ ] **Step 2: Habilitar todo el calendario**

Eliminar `disabled={{ before: minimumDate }}` del componente `Calendar`. Mantener:

```tsx
const minimumDate = getPanamaTomorrow();
const initialDate = notification.fechaPrometidaPago ?? minimumDate;
```

para conservar mañana como valor predeterminado.

- [ ] **Step 3: Actualizar el texto informativo**

Usar:

```tsx
<p className="text-xs text-muted-foreground">
  Puedes seleccionar una fecha pasada, la fecha de hoy o una fecha futura.
</p>
```

- [ ] **Step 4: Ejecutar las pruebas enfocadas y confirmar GREEN**

Run:

```bash
npm test -- --run src/application/use-cases/notificaciones/payment-promise.test.ts src/components/notificaciones/ventas-proximas/PaymentPromiseDialog.test.tsx src/components/notificaciones/ventas-proximas/PaymentPromiseDialog.expired.test.tsx
```

Expected: PASS.

### Task 3: Validación integral

**Files:**
- Verify all changed files.

- [ ] **Step 1: Ejecutar ESLint**

```bash
npx eslint src/application/use-cases/notificaciones/payment-promise.ts src/application/use-cases/notificaciones/payment-promise.test.ts src/components/notificaciones/ventas-proximas/PaymentPromiseDialog.tsx src/components/notificaciones/ventas-proximas/PaymentPromiseDialog.test.tsx src/components/notificaciones/ventas-proximas/PaymentPromiseDialog.expired.test.tsx
```

- [ ] **Step 2: Ejecutar la suite completa**

```bash
npm test -- --run
```

Expected: todos los archivos y pruebas pasan.

- [ ] **Step 3: Ejecutar el build de producción**

```bash
npm run build
```

Expected: compilación y TypeScript finalizan correctamente.

- [ ] **Step 4: Revisar el diff**

Confirmar que mañana sigue siendo el valor inicial, no existe límite de calendario y no se modificaron cambios previos del usuario.

