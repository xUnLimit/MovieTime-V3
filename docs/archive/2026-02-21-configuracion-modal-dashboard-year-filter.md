# Design: Configuración Modal + Filtro de Año en Dashboard

**Date:** 2026-02-21
**Status:** Approved
**Version:** 1.0

---

## Overview

Activate the currently-disabled "Configuración" option in the `UserMenu` avatar dropdown. Opens a `Dialog` modal with a single feature: a **year filter for the dashboard**. The selected year controls what time range the dashboard widgets aggregate, while the charts remain independently controlled.

---

## Scope

- Enable the `Configuración` menu item in `UserMenu.tsx`
- Create a `ConfiguracionDialog` component (shadcn Dialog)
- Add a `dashboardFilterStore` (Zustand + localStorage) to persist the selected year
- Modify `DashboardMetrics` widgets to sum data from the selected year onward
- Modify `dashboardStatsService` to store unlimited historical months (remove 12-month cap)
- The `Recalcular métricas` rebuild will reconstruct all historical data from `pagosVenta` and `pagosServicio`

**Not in scope:** Charts (`IngresosVsGastosChart`, `CrecimientoUsuarios`, etc.) are NOT affected by the year filter — they keep their own internal selectors.

---

## 1. Modal de Configuración

**Trigger:** Click on "Configuración" in the `UserMenu` dropdown.

**Component:** `ConfiguracionDialog` — a shadcn `Dialog` opened via state in `UserMenu`.

**Content:**
- Section header: "Vista del Dashboard"
- A `Select` showing available years (derived from historical data)
- Helper text: "Los widgets de métricas mostrarán datos acumulados desde el inicio del año seleccionado hasta hoy."
- "Guardar" button that persists to localStorage and closes the dialog

**Access:** Available to all roles (admin and operador).

**No tabs or additional sections** — keep it focused.

---

## 2. Filtro de Año — Comportamiento

### Widgets (`DashboardMetrics`)

The selected year acts as a **start-of-year cutoff**, not a single-year filter:

| Selected Year | Widget Shows |
|---------------|-------------|
| 2026 (default) | Sum from Jan 2026 → today |
| 2025 | Sum from Jan 2025 → today |
| 2024 | Sum from Jan 2024 → today |

**Affected widgets:**
- Gastos Totales
- Ingresos Totales
- Ganancias Totales

**Not affected by the year filter:**
- Gasto Mensual Esperado (always current month)
- Ingreso Mensual Esperado (always current month)

Implementation: filter `stats.ingresosPorMes[]` to entries where `mes >= "${selectedYear}-01"`, then sum `ingresos` and `gastos`.

### Gráfica (`IngresosVsGastosChart`)

**No changes.** The chart keeps its own internal selector (mes actual / 3 meses / 6 meses / 12 meses). The dashboard year filter does not affect the chart. If the selected year falls outside the chart's 12-month window, the chart will simply show available data within its own range.

### Available Years in Selector

- Derived from unique years present in `stats.ingresosPorMes[]` (which uses `fechaInicio` / period start date from payments — not registration date)
- Sorted descending (most recent first)
- Default: current year
- Max: current year (no future years)

---

## 3. Technical Changes

### 3a. Remove month cap in `dashboardStatsService`

**Current behavior:** `keepLast12Months()` discards data older than 12 months from `ingresosPorMes` and `usuariosPorMes`.

**New behavior:** Store all months indefinitely — no trimming. The arrays grow with the full history.

- Remove or disable `keepLast12Months()` calls in `adjustIngresosStats`, `adjustGastosStats`, `adjustUsuariosPorMes`, and `rebuildDashboardStats`.

### 3b. Rebuild recovers full history

When the user triggers "Recalcular métricas" (`recalculateDashboard` → `rebuildDashboardStats`):
- Reads all `pagosVenta` and `pagosServicio` from Firestore
- Uses `fechaInicio` (period start) as the date for chart placement (not `fecha` registration date)
- Rebuilds `ingresosPorMes[]` with all months present in payments, going back to 2024 or further

### 3c. New `dashboardFilterStore`

```typescript
// src/store/dashboardFilterStore.ts
interface DashboardFilterState {
  selectedYear: number;         // e.g. 2026
  setSelectedYear: (year: number) => void;
}
```

- Uses Zustand with `persist` middleware → `localStorage`
- Default: current year (`new Date().getFullYear()`)
- No Firebase reads

### 3d. File changes summary

| File | Change |
|------|--------|
| `src/components/layout/UserMenu.tsx` | Enable Configuración item, add state to open dialog |
| `src/components/layout/ConfiguracionDialog.tsx` | New component — the modal |
| `src/store/dashboardFilterStore.ts` | New store — persisted year preference |
| `src/lib/services/dashboardStatsService.ts` | Remove `keepLast12Months()` calls |
| `src/components/dashboard/DashboardMetrics.tsx` | Filter `ingresosPorMes` by selected year |

---

## 4. Data Flow

```
User opens UserMenu → clicks "Configuración"
  → ConfiguracionDialog opens
  → Loads available years from stats.ingresosPorMes
  → User selects year → saved to dashboardFilterStore (localStorage)
  → Dialog closes

DashboardMetrics mounts
  → reads stats.ingresosPorMes from dashboardStore
  → reads selectedYear from dashboardFilterStore
  → filters: months where mes >= `${selectedYear}-01`
  → sums ingresos and gastos for those months
  → displays filtered totals
```

---

## 5. Edge Cases

- **No historical data for selected year:** Widgets show $0.00 (same as today if no payments recorded yet)
- **First run (dashboard_stats has no data):** Selector shows only current year; widgets show $0.00 until rebuild
- **Rebuild not yet run:** Selector derives years from whatever `ingresosPorMes` currently has in Firestore
- **User clears localStorage:** Filter resets to current year on next load

---

## 6. Out of Scope (Future)

- Perfil page (currently disabled, stays disabled)
- Notification settings in this modal (already managed in `config/global`)
- WhatsApp prefix configuration
- Export to CSV

---

**Approved by:** User
**Ready for:** Implementation planning
