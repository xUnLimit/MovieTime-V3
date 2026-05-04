# Dashboard Metrics Optimization Design

**Date:** 2026-02-22
**Status:** Approved

## Problem

Dashboard metrics (charts, forecasts, totals) do not update automatically after many in-app operations. The user must manually click "Recalcular métricas" which reads every document in 6 Firestore collections — expensive and unnecessary.

## Root Cause

The system has incremental update functions (`adjustIngresosStats`, `adjustGastosStats`, `upsertVentaPronostico`, `upsertServicioPronostico`) that work correctly, but they are only called during **create** and **delete** operations. Several common operations bypass them entirely.

## Gap Analysis

| # | Operation | Location | Missing Dashboard Call |
|---|-----------|----------|----------------------|
| 1 | Venta estado activo→inactivo | `VentasEditForm.tsx` | `upsertVentaPronostico(null)` — remove from forecast |
| 2 | Venta estado inactivo→activo | `VentasEditForm.tsx` | `upsertVentaPronostico(venta)` — add to forecast |
| 3 | Venta "Cortar" from notifications | `VentasProximasTable.tsx` | `upsertVentaPronostico(null)` — remove from forecast |
| 4 | Venta renewed (detail page) | `ventas/[id]/page.tsx` | `adjustIngresosStats` for new revenue (already has `upsertVentaPronostico`) |
| 5 | Venta renewed (notifications) | `VentasProximasTable.tsx` | `adjustIngresosStats` for new revenue |
| 6 | Servicio activo→inactivo (or reverse) | `serviciosStore.updateServicio` | `upsertServicioPronostico` — add/remove from forecast |
| 7 | Servicio renewed (detail page) | `servicios/detalle/[id]/page.tsx` | `adjustGastosStats` + `upsertServicioPronostico` |
| 8 | Servicio renewed (notifications) | `ServiciosProximosTable.tsx` | `adjustGastosStats` + `upsertServicioPronostico` |

## Design Decisions

### Status changes affect forecast only, NOT historical totals

When a venta/servicio changes from active→inactive (or vice versa):
- **DO** update `ventasPronostico` / `serviciosPronostico` (future projections)
- **DO NOT** update `ingresosTotal`, `gastosTotal`, `ingresosPorMes`, etc. (historical payments already happened)

### Renewals create new revenue/expense entries

When a venta/servicio is renewed:
- **DO** call `adjustIngresosStats` / `adjustGastosStats` (new payment = new revenue/cost)
- **DO** call `upsertVentaPronostico` / `upsertServicioPronostico` (updated end date for forecast)

## Part 1: Incremental Gap Fixes

### Fix 1: VentasEditForm — status change → forecast sync

**File:** `src/components/ventas/VentasEditForm.tsx`

After the existing `adjustServiciosActivos` block (line ~546), add forecast sync:

```typescript
// Sync dashboard forecast when estado changes
if (prevEstadoActivo !== nextEstadoActivo) {
  const ventaPronostico = nextEstadoActivo
    ? {
        id: venta.id,
        categoriaId: data.categoriaId,
        fechaInicio: data.fechaInicio instanceof Date ? data.fechaInicio.toISOString() : String(data.fechaInicio),
        fechaFin: data.fechaFin instanceof Date ? data.fechaFin.toISOString() : String(data.fechaFin),
        cicloPago: plan?.cicloPago || venta.cicloPago,
        precioFinal: precioFinalValue,
        moneda: metodoPagoSeleccionado?.moneda || venta.moneda || 'USD',
      }
    : null;
  upsertVentaPronostico(ventaPronostico, venta.id).catch(() => {});
}
```

### Fix 2: VentasProximasTable — "Cortar" → forecast sync

**File:** `src/components/notificaciones/VentasProximasTable.tsx`

In `handleCortarFromModal` (after step 3), add:

```typescript
// 5. Remove from dashboard forecast
upsertVentaPronostico(null, notifSeleccionada.ventaId).catch(() => {});
```

### Fix 3: VentasProximasTable — renewal → adjustIngresosStats

**File:** `src/components/notificaciones/VentasProximasTable.tsx`

In `handleConfirmRenovacion` (after `crearPagoRenovacion`), add:

```typescript
// Sync dashboard ingresos for the new payment
adjustIngresosStats({
  delta: monto,
  moneda: data.moneda || metodoPagoSeleccionado?.moneda || notifSeleccionada.moneda || 'USD',
  mes: getMesKeyFromDate(data.fechaInicio),
  dia: getDiaKeyFromDate(data.fechaInicio),
  categoriaId: notifSeleccionada.categoriaId || '',
  categoriaNombre: notifSeleccionada.categoriaNombre || '',
}).catch(() => {});
```

### Fix 4: Venta detail page — renewal → adjustIngresosStats

**File:** `src/app/(dashboard)/ventas/[id]/page.tsx`

In `handleConfirmRenovacion` (after `upsertVentaPronostico`), add:

```typescript
// Sync dashboard ingresos for the new payment
adjustIngresosStats({
  delta: monto,
  moneda: data.moneda || metodoPagoSeleccionado?.moneda || venta.moneda || 'USD',
  mes: getMesKeyFromDate(data.fechaInicio),
  dia: getDiaKeyFromDate(data.fechaInicio),
  categoriaId: venta.categoriaId ?? '',
  categoriaNombre: venta.categoriaNombre ?? '',
}).catch(() => {});
```

### Fix 5: serviciosStore.updateServicio — status change → forecast sync

**File:** `src/store/serviciosStore.ts`

In `updateServicio`, after the category counter update block (line ~262), add:

```typescript
// Sync dashboard forecast when activo changes
if (updates.activo !== undefined && updates.activo !== servicio.activo) {
  const updatedServicio = { ...servicio, ...finalUpdates };
  const servicioPronostico = toServicioPronostico(updatedServicio as Servicio);

  // Update local dashboard state immediately
  import('./dashboardStore').then(({ useDashboardStore }) => {
    const currentStats = useDashboardStore.getState().stats;
    if (currentStats) {
      const existing = currentStats.serviciosPronostico ?? [];
      const updated = servicioPronostico
        ? existing.some(s => s.id === id)
          ? existing.map(s => s.id === id ? servicioPronostico : s)
          : [...existing, servicioPronostico]
        : existing.filter(s => s.id !== id);
      useDashboardStore.setState({
        stats: { ...currentStats, serviciosPronostico: updated },
      });
    }
  }).catch(() => {});

  upsertServicioPronostico(servicioPronostico, id).catch(() => {});
}
```

### Fix 6: Servicio detail page — renewal → adjustGastosStats + forecast

**File:** `src/app/(dashboard)/servicios/detalle/[id]/page.tsx`

In `handleConfirmRenovacion` (after `adjustCategoriaGastos`), add:

```typescript
// Sync dashboard gastos for the new payment
adjustGastosStats({
  delta: data.costo,
  moneda: data.moneda || metodoPagoSeleccionado?.moneda || 'USD',
  mes: getMesKeyFromDate(data.fechaInicio),
  dia: getDiaKeyFromDate(data.fechaInicio),
  categoriaId: servicio?.categoriaId,
  categoriaNombre: servicio?.categoriaNombre,
}).catch(() => {});

// Update forecast with new dates
upsertServicioPronostico({
  id,
  fechaVencimiento: data.fechaVencimiento.toISOString(),
  cicloPago: data.periodoRenovacion,
  costoServicio: data.costo,
  moneda: data.moneda || metodoPagoSeleccionado?.moneda || 'USD',
}, id).catch(() => {});
```

### Fix 7: ServiciosProximosTable — renewal → adjustGastosStats + forecast

**File:** `src/components/notificaciones/ServiciosProximosTable.tsx`

In `handleConfirmRenovacion` (after `adjustCategoriaGastos`), add the same pattern as Fix 6.

### Fix 8: Dashboard store cache invalidation

**File:** `src/store/dashboardStore.ts`

Add a method to invalidate the cache so the dashboard re-fetches on next visit:

```typescript
invalidateCache: () => {
  set({ lastFetch: null, lastStatsFetch: null });
}
```

Listen for cross-module events in the dashboard page to invalidate when needed.

## Part 2: Rebuild Optimization

### Changes to `rebuildDashboardStats()`

1. **Remove** the `writeBatch` that updates `gastosTotal` on every servicio document
2. **Remove** the `writeBatch` that updates `gastosTotal` on every categoría document
3. **Remove** the extra `getAll(CATEGORIAS)` read that was only needed for the batch
4. **Keep** the 5-collection read (VENTAS, PAGOS_VENTA, SERVICIOS, PAGOS_SERVICIO, USUARIOS) as these are necessary for full recalculation

### Before vs After

| Metric | Before | After |
|--------|--------|-------|
| Collections read | 6 (including CATEGORIAS) | 5 |
| Write batches | 2 (servicios + categorías) | 0 |
| Individual writes | N servicios + N categorías + 1 | 1 (dashboard_stats only) |
| Purpose | Full rebuild + side-effect fixes | Pure dashboard stats rebuild |

## Cost Analysis

### Per-operation cost (after fixes)

Each incremental update uses a Firestore transaction on `config/dashboard_stats`:
- 1 read (the stats doc) + 1 write (update the stats doc)
- Total: 2 operations per adjustment
- This is already being paid for create/delete; we just add it to edit/renew/status-change

### Rebuild cost (optimized)

- 5 collection reads + 1 write
- No longer updates servicios/categorías documents
