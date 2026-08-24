# Cortar Red Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Identificar `Cortar` como acción destructiva usando rojo en el menú y en su diálogo.

**Architecture:** Mantener los componentes actuales y cambiar únicamente las clases de color. Las pruebas de componentes fijarán los acentos rojos para impedir regresiones hacia naranja.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest y Testing Library.

---

### Task 1: Acción Cortar del menú

**Files:**
- Modify: `src/components/notificaciones/ventas-proximas/VentasProximasActionsMenu.test.tsx`
- Modify: `src/components/notificaciones/ventas-proximas/VentasProximasActionsMenu.tsx`

- [ ] **Step 1: Escribir la prueba fallida**

Después de abrir el menú, localizar `Cortar` y comprobar que su texto usa rojo:

```tsx
const cutItem = screen.getByRole('menuitem', { name: 'Cortar' });
expect(cutItem.querySelector('span')?.className).toContain('text-red-600');
```

- [ ] **Step 2: Confirmar el fallo**

Run: `npm test -- --run src/components/notificaciones/ventas-proximas/VentasProximasActionsMenu.test.tsx`

Expected: FAIL porque actualmente usa `text-orange-600`.

- [ ] **Step 3: Aplicar el color rojo**

Cambiar las clases del icono y texto:

```tsx
<Scissors className="mr-2 h-4 w-4 text-red-600" />
<span className="text-red-600">Cortar</span>
```

- [ ] **Step 4: Confirmar que pasa**

Run: `npm test -- --run src/components/notificaciones/ventas-proximas/VentasProximasActionsMenu.test.tsx`

Expected: PASS.

### Task 2: Interfaz Cortar venta

**Files:**
- Create: `src/components/notificaciones/ventas-proximas/CutVentaDialog.test.tsx`
- Modify: `src/components/notificaciones/ventas-proximas/CutVentaDialog.tsx`

- [ ] **Step 1: Escribir la prueba fallida**

Renderizar el diálogo y comprobar el acento del encabezado y del botón:

```tsx
expect(screen.getByTestId('cut-dialog-icon').className).toContain('bg-red-100');
expect(screen.getByRole('button', { name: 'Cortar venta' }).className)
  .toContain('bg-red-600');
```

- [ ] **Step 2: Confirmar el fallo**

Run: `npm test -- --run src/components/notificaciones/ventas-proximas/CutVentaDialog.test.tsx`

Expected: FAIL porque el diálogo usa clases naranjas.

- [ ] **Step 3: Aplicar el acento destructivo**

Usar `bg-red-100 dark:bg-red-500/20`, `text-red-600` y `bg-red-600 hover:bg-red-700` en los tres acentos existentes.

- [ ] **Step 4: Verificar y revisar lint**

Run: `npm test -- --run src/components/notificaciones/ventas-proximas/VentasProximasActionsMenu.test.tsx src/components/notificaciones/ventas-proximas/CutVentaDialog.test.tsx`

Run: `npx eslint src/components/notificaciones/ventas-proximas/VentasProximasActionsMenu.tsx src/components/notificaciones/ventas-proximas/VentasProximasActionsMenu.test.tsx src/components/notificaciones/ventas-proximas/CutVentaDialog.tsx src/components/notificaciones/ventas-proximas/CutVentaDialog.test.tsx`

Expected: ambas comprobaciones pasan. No crear commit ni push sin solicitud explícita.
