# Dashboard Implementation Design

**Date:** 2026-02-13  
**Status:** Approved

## Overview

Implement a fully functional dashboard with minimal Firebase reads using a single denormalized `config/dashboard_stats` document as the source of truth for financial and chart data.

## Read Budget

| Source | Cost | Data |
|--------|------|------|
| `getCount('ventas', estado='activo')` | 0 reads (free) | Ventas activas |
| `getCount('usuarios', tipo='cliente')` | 0 reads (free) | Total clientes |
| `getCount('usuarios', tipo='revendedor')` | 0 reads (free) | Total revendedores |
| `getById('config', 'dashboard_stats')` | 1 read | All financial + chart data |
| `queryDocuments('activityLog', limit=6)` | 6 reads | Recent activity |
| **Total** | **7 reads** | Full dashboard |

Second visit within 5 minutes: **0 reads** (dashboardStore cache).

## `config/dashboard_stats` Document Structure

```typescript
interface DashboardStats {
  // Financial totals (in USD)
  gastosTotal: number
  ingresosTotal: number

  // Chart: User growth (last 12 months)
  usuariosPorMes: Array<{
    mes: string           // "YYYY-MM"
    clientes: number
    revendedores: number
  }>

  // Chart: Income vs Expenses (last 12 months)
  ingresosPorMes: Array<{
    mes: string           // "YYYY-MM"
    ingresos: number      // USD
    gastos: number        // USD
  }>

  // Chart: Revenue by category (cumulative)
  ingresosPorCategoria: Array<{
    categoriaId: string
    nombre: string
    total: number         // USD
  }>

  updatedAt: Date
}
```

**Notes:**
- Document created with zeros on first mutation (no migration needed — no historical data exists)
- `gananciasTotal = ingresosTotal - gastosTotal` calculated client-side, not stored
- `gastoMensualEsperado` and `ingresoMensualEsperado` are **deferred** — not implemented in this phase

## Architecture

### New Files

| File | Purpose |
|------|---------|
| `src/lib/services/dashboardStatsService.ts` | Atomic update helpers for `dashboard_stats` |
| `src/store/dashboardStore.ts` | Zustand store with 5-min cache |
| `src/types/dashboard.ts` | Update with `DashboardStats` interface (replace placeholder) |

### Modified Files

| File | Change |
|------|--------|
| `src/store/ventasStore.ts` | Call `adjustIngresosStats()` on create/delete |
| `src/store/serviciosStore.ts` | Call `adjustGastosStats()` on create/delete |
| `src/store/usuariosStore.ts` | Call `adjustUsuariosPorMes()` on create/delete |
| `src/components/dashboard/DashboardMetrics.tsx` | Connect to dashboardStore |
| `src/components/dashboard/CrecimientoUsuarios.tsx` | Connect to dashboardStore |
| `src/components/dashboard/IngresosVsGastosChart.tsx` | Implement chart + connect |
| `src/components/dashboard/RevenueByCategory.tsx` | Implement chart + connect |
| `src/components/dashboard/RecentActivity.tsx` | Direct query, no store |
| `src/app/(dashboard)/dashboard/page.tsx` | Orchestrate store loads |

## `dashboardStatsService.ts` API

```typescript
// Called by ventasStore on create/delete venta
adjustIngresosStats(params: {
  delta: number        // positive on create, negative on delete
  moneda: string
  mes: string          // "YYYY-MM" of fechaInicio
  categoriaId: string
  categoriaNombre: string
}): Promise<void>

// Called by serviciosStore on create/delete servicio
adjustGastosStats(params: {
  delta: number
  moneda: string
  mes: string          // "YYYY-MM" of createdAt
}): Promise<void>

// Called by usuariosStore on create/delete usuario
adjustUsuariosPorMes(params: {
  mes: string          // "YYYY-MM" of createdAt
  tipo: 'cliente' | 'revendedor'
  delta: 1 | -1
}): Promise<void>
```

Each function:
1. Reads current `dashboard_stats` (or creates with zeros if missing)
2. Applies delta to the relevant field/array entry
3. Writes back with `updatedAt: now`

## `dashboardStore.ts` Pattern

Follows the standard store pattern with 5-min TTL cache:

```typescript
interface DashboardState {
  stats: DashboardStats | null
  counts: { ventasActivas: number; totalClientes: number; totalRevendedores: number }
  recentActivity: ActivityLog[]
  isLoading: boolean
  error: string | null
  lastFetch: number | null
  fetchDashboard: (force?: boolean) => Promise<void>
}
```

`fetchDashboard()` fires all 3 data fetches in parallel:
- `getById('config', 'dashboard_stats')`
- `getCount()` x3
- `queryDocuments('activityLog', orderBy DESC, limit 6)`

## Component Changes

### `DashboardMetrics.tsx`
- 4 cards: Gastos Totales, Ingresos Totales, Ganancias Totales, Ventas Activas
- `gananciasTotal` = `ingresosTotal - gastosTotal` (client-side)
- Use `formatAggregateInUSD()` for money values
- ~~Gasto/Ingreso Mensual Esperado~~ — deferred

### `CrecimientoUsuarios.tsx`
- Already has Recharts AreaChart — just pass `stats.usuariosPorMes`
- Period selector filters the array client-side (no extra reads)

### `IngresosVsGastosChart.tsx`
- Implement Recharts `BarChart` (grouped bars: ingresos/gastos per month)
- Data: `stats.ingresosPorMes`

### `RevenueByCategory.tsx`
- Implement Recharts `PieChart` or horizontal `BarChart`
- Data: `stats.ingresosPorCategoria`

### `RecentActivity.tsx`
- Direct query: `queryDocuments('activityLog', { orderBy: 'timestamp', direction: 'desc', limit: 6 })`
- No store dependency
- Already has the timeline UI ready

## Deferred

- `gastoMensualEsperado` — pending specification
- `ingresoMensualEsperado` — pending specification
- Date range filtering on charts
- Refresh button (stores handle force-refresh already)
