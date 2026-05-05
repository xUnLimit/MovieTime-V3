# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MovieTime PTY is a subscription management system for streaming services in Panama. It manages clients, resellers, services (Netflix, Disney+, etc.), sales, categories, payment methods, and automatic notifications. Backed by **Supabase** (PostgreSQL + Auth + RLS).

The system was migrated from Firebase/Firestore to a normalized Supabase schema in May 2026 (`migration/supabase-normalized` branch). See `docs/plans/supabase normalized migration.md` for the full migration design and `docs/plans/2026-05-05-supabase-v2-hardening.md` for the V2 hardening notes.

**Note**: Legacy Subscriptions and Service Payments modules were removed in January 2026 (commit db25141). Replaced by **Ventas** module and **Servicios Detalle** system.

## 🔥 CRITICAL RULES (Always Follow)

1. **Tables with >10 items** → MUST use `useServerPagination` hook (never `getAll()`)
2. **Counters** → Derived by SQL views (`v_categoria_counters`, `v_usuarios_servicios_activos`) or maintained by triggers (`recalc_perfiles_ocupados`). Never recompute from the client.
3. **Financial totals** → Use `sumInUSD()` + `formatAggregateInUSD()` (multi-currency)
4. **Venta payments** → Stored in `pagos_venta` table linked to `venta_periodos` (never embedded in venta row)
5. **MetodoPago** → `asociado_a: 'usuario' | 'servicio'` segregates them; query the right subset
6. **Snapshots are immutable** → `*_snapshot` columns preserve historical state; never overwrite from current catalog
7. **Dashboard stats** → Single source of truth is `rebuild_dashboard_financial_stats()` SQL RPC; the TS layer only reads `dashboard_stats` and triggers the RPC
8. **Font** → NEVER use `font-mono`. Always use Inter (default)
9. **Stores** → NEVER use deprecated `clientesStore`/`revendedoresStore`; use `usuariosStore`
10. **No denormalized writes from app code** → Sale/service display fields are read from views (`v_ventas_full`, `v_servicios_full`); writing them via `update()` is silently dropped by the compat layer

**Pagination guide**: `docs/PAGINATION_AND_CACHE_PATTERN.md`
**Currency conversion guide**: `docs/plans/2026-02-12-currency-conversion-design.md`
**Migration plan**: `docs/plans/supabase normalized migration.md`
**V2 hardening**: `docs/plans/2026-05-05-supabase-v2-hardening.md`

---

## Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | Next.js | 16.1.6 |
| Language | TypeScript | 5.x |
| UI | React | 19.2.3 |
| Styling | Tailwind CSS | 4.x |
| Components | shadcn/ui + Radix UI | Latest |
| State | Zustand | 5.0.10 |
| Forms | React Hook Form + Zod | 7.71.1 / 4.3.6 |
| Backend | Supabase (PostgreSQL + Auth + RLS) | 2.x |
| Charts | Recharts | 3.7.0 |
| Date | date-fns | 4.1.0 |
| Testing | Vitest | 4.0.18 |
| Legacy migration scripts | firebase-admin | 13.x |

---

## Project Structure

```
src/
├── app/(dashboard)/        # routes mirror modules (dashboard, servicios, usuarios, ventas, categorias, metodos-pago, notificaciones, editor-mensajes, log-actividad, reposo)
├── components/             # layout, dashboard, servicios, ventas, usuarios, categorias, metodos-pago, notificaciones, editor-mensajes, log-actividad, shared, ui
├── hooks/                  # useServerPagination, useVentasMetrics, use-pagos-venta, use-pagos-servicio, etc.
├── lib/
│   ├── supabase/           # client.ts, auth.ts, mappers.ts, pagination.ts, queries.ts, compat.ts (Firestore-shaped legacy API), database.types.ts
│   ├── services/           # dashboardStatsService, currencyService, notificationSyncService, pagosVentaService, pagosServicioService, ventaSyncService, servicioSyncService, metodoPagoSyncService, centralSyncService
│   └── utils/              # calculations, whatsapp, analytics, devLogger, activityLogHelpers, cn
├── store/                  # 11 Zustand stores
└── types/                  # auth, categorias, clientes, common, dashboard, metodos-pago, notificaciones, servicios, ventas, whatsapp

supabase/
└── migrations/             # 26 SQL migrations (V1 base + V2 hardening)

scripts/
├── data-fixes/             # one-shot UPDATEs against legacy Firebase IDs (do NOT belong in supabase/migrations)
└── ...                     # migrate-to-supabase, audit-*, validate-*, sync-supabase-auth-users, etc.
```

---

## Supabase Schema

### Core entity tables
- `usuarios` — clients + resellers (`tipo: cliente | revendedor`). `servicios_activos` is **derived** by `v_usuarios_servicios_activos`, not stored.
- `categorias` + `planes_tipos` + `planes` — catalog. `(plan_tipo_id, categoria_id)` composite FK guarantees integrity.
- `servicios` — streaming subscriptions. `perfiles_ocupados` is maintained by trigger `recalc_perfiles_ocupados`.
- `metodos_pago` — `asociado_a: usuario | servicio`.

### Financial tables (entity → periods → payments)
- `ventas → venta_periodos → pagos_venta`
- `servicios → servicio_periodos → pagos_servicio`
- `gastos` — manual expenses
- `currencies` + `exchange_rates` — multi-currency catalog and rate cache (24h TTL via Supabase Edge fetch on demand)

### Notification tables
- `notificaciones` (base) + `notificaciones_venta` / `notificaciones_servicio` / `notificaciones_reposo` (detail per `entidad`)
- `dedupe_key` UNIQUE for idempotent sync
- All `*_snapshot` columns are immutable per row

### Other
- `dashboard_stats` (singleton cache, rebuilt by RPC)
- `activity_log` (delete admin-only)
- `templates` (WhatsApp message templates)
- `legacy_orphan_records` (Firebase records whose FKs could not be resolved)
- `profiles` (mirrors `auth.users` with role)

### Key views
- `v_categoria_counters` — totalServicios, serviciosActivos, perfilesDisponiblesTotal
- `v_usuarios_servicios_activos` — derived `servicios_activos`
- `v_servicios_disponibilidad` — perfiles libres per servicio
- `v_venta_periodos_full`, `v_servicio_periodos_full` — `estado_pago` derived (`pendiente | parcial | pagado | sobrepagado`)
- `v_ventas_full`, `v_servicios_full` — list views with last-period and last-payment LATERAL joins (display fields like `ultimo_metodo_pago_nombre`, `servicio_contrasena`)
- `v_pagos_venta_full`, `v_pagos_servicio_full` — payments enriched with parent context
- `v_categoria_financial_metrics` — operational profitability per category (excludes legacy orphans)
- `v_notificaciones_venta` / `_servicio` / `_reposo`

### Key SQL functions
- `rebuild_dashboard_financial_stats()` — single source of truth for dashboard cache. Uses `pg_advisory_xact_lock` to serialize concurrent rebuilds. Locale: `America/Panama`. Sources: `pagos_venta`, `pagos_servicio`, `gastos`, plus `legacy_orphan_records` for historical totals.
- `auth_role()` — returns the current user's role from `profiles` (used inside RLS).
- `is_authenticated()` — RLS helper.
- `run_all_validations()` — aggregate validation report.

### RLS posture
- All tables RLS-enabled, all views with `WITH (security_invoker = true)`.
- Operators (authenticated) can SELECT/INSERT/UPDATE most tables; DELETE is admin-only on `activity_log` and on the `notificaciones` base.
- `notificaciones_*` detail tables have explicit SELECT/INSERT/UPDATE/DELETE policies (V2 cleanup, see `20260505023500_v2_rls_policy_cleanup.sql`).
- `gastos` is admin-only.

---

## Compat layer

`src/lib/supabase/compat.ts` exposes a Firestore-shaped API (`getAll`, `getById`, `queryDocuments`, `getCount`, `create`, `update`, `remove`, `COLLECTIONS`) on top of Supabase. It is intentionally kept while we migrate stores and components to dedicated repositories.

Important caveats:
- **Writes are filtered**: payload fields that no longer exist on the SQL table (denormalized columns like `servicioNombre`, `categoriaNombre`, `metodoPagoNombre`) are silently dropped. Do not rely on them being persisted.
- **Reads come from views** for `ventas`/`servicios`/`pagos_*`. The returned shape mimics the old Firestore docs, but the underlying source is `v_*_full`.
- Long-term goal: replace per-call sites with `src/lib/supabase/queries.ts` repository functions.

---

## Stores (Zustand)

All stores follow: 5-min cache TTL, error states, optimistic deletes with rollback.

```typescript
fetchItems: async (force = false) => {
  if (!force && lastFetch && Date.now() - lastFetch < 300000) return logCacheHit(COLLECTIONS.X);
  set({ isLoading: true, error: null });
  try {
    const items = await getAll<T>(COLLECTIONS.X);
    set({ items, isLoading: false, lastFetch: Date.now() });
  } catch (e) { set({ error: e.message, isLoading: false }); }
}
```

- `authStore` — Supabase Auth + localStorage
- `usuariosStore` — Unified clients+resellers. Selectors `getClientes()`, `getRevendedores()`. `serviciosActivos` is read from `v_usuarios_servicios_activos`.
- `serviciosStore` — Profile counters maintained by trigger; the store just refetches.
- `ventasStore` — Creates a `venta_periodos` row + initial `pagos_venta` row on creation.
- `categoriasStore` — Counters derived from views; `resyncContadoresCategorias()` is a refetch.
- `metodosPagoStore` — `fetchMetodosPagoUsuarios()`, `fetchMetodosPagoServicios()`, `toggleActivo()`.
- `notificacionesStore` — 5-min TTL. `toggleLeida`, `toggleResaltada`, `deleteNotificacionesPorVenta`, `deleteNotificacionesPorServicio`.
- `dashboardStore` — Reads `dashboard_stats` cache.
- `activityLogStore`, `configStore`, `templatesStore` — backed by Supabase tables.

---

## Type System (`src/types/`)

- **`Usuario`** (`clientes.ts`) — `tipo: cliente | revendedor`, `serviciosActivos` (read-only, derived), `moneda`
- **`Servicio`** (`servicios.ts`) — last-period display fields (`ultimoMetodoPagoNombre`, `ultimoCostoOriginal`, etc.)
- **`VentaDoc`** (`ventas.ts`) — last-period display fields exposed by `v_ventas_full`. The `pagos` field is @deprecated.
- **`PagoVenta`** (`ventas.ts`) — separate `pagos_venta` table linked to `venta_periodos`. `metodo_pago_nombre_snapshot` preserves history.
- **`Categoria`** (`categorias.ts`) — derived counters (totalServicios, serviciosActivos, perfilesDisponiblesTotal). `planes: Plan[]`.
- **`MetodoPago`** (`metodos-pago.ts`) — `asociadoA: usuario | servicio`.
- **`Notificacion`** (`notificaciones.ts`) — Union: `NotificacionVenta | NotificacionServicio | NotificacionReposo`. Guards: `esNotificacionVenta()`, `esNotificacionServicio()`.

**Payment Cycles**: `mensual` (1m), `trimestral` (3m), `semestral` (6m), `anual` (12m)

---

## Multi-Currency System

Individual rows → original currency. Aggregated totals → USD.

```typescript
// Totals
const total = await sumInUSD(pagos.map(p => ({ monto: p.monto, moneda: p.moneda })));
<MetricCard value={formatAggregateInUSD(total)} />

// Rows
<td>{getCurrencySymbol(pago.moneda)} {pago.monto.toFixed(2)}</td>
```

Exchange rates: `open.er-api.com` (free, no API key). Cached in Supabase `exchange_rates` table for 24h. Each financial fact stores its own `monto_usd` + `exchange_rate` so historical totals do not drift when current rates change.

---

## Module Details

### Servicios
- `tipo` is the `plan_tipo_id` from the parent `Categoria`; `tipoNombre` is the snapshot
- Payment history in `pagos_servicio` (created automatically on creation via `servicio_periodos`)
- Detail page: `/servicios/detalle/[id]`
- On delete: dispatches `window.dispatchEvent(new Event('servicio-deleted'))`

### Ventas
- `ventas → venta_periodos → pagos_venta`
- Create flow: venta + first venta_periodo + initial pagos_venta together
- On delete: trigger recomputes `perfiles_ocupados`. Notifications regenerated.
- Hooks: `use-pagos-venta.ts`, `use-ventas-usuario.ts`

### Usuarios
- Single `usuarios` table with `tipo: cliente | revendedor`
- `servicios_activos` derived by `v_usuarios_servicios_activos`

### Categorias
- Counters derived by `v_categoria_counters` (do not write them)
- `v_categoria_financial_metrics` for profitability (operational, excludes orphans)

### Notificaciones
- Synced via `notificationSyncService.ts` — runs once per day (localStorage cache) and on manual refresh
- `entidad`: `venta | servicio | reposo`. Priorities: `baja | media | alta | critica`
- `critica` = expired or due today, `alta` ≤ 3 days, `media` ≤ 7 days
- Bell icon in header (`NotificationBell`) shows pulsing dot for unread
- WhatsApp message editable before sending; edits not persisted to templates

### Editor de Mensajes
- Templates in `templates` table, backed by `templatesStore`

### Log de Actividad
- `activity_log` table, DELETE admin-only

### Metodos de Pago
- `asociado_a: usuario | servicio` — always use the filtered fetch methods

### Authentication
- Supabase Auth. `profiles` table mirrors `auth.users` with role.
- Email starting with `admin@` is provisioned as admin (legacy convention)
- Route protection: client-side in `(dashboard)/layout.tsx`

---

## Data Flow

1. Mount → `fetchItems()` checks 5-min cache → Supabase if stale
2. Local filtering via `useMemo` (no extra reads)
3. CRUD → store method → Supabase + local state + toast
4. Mutations → SQL triggers maintain derived columns (`perfiles_ocupados`); views derive read-only counters
5. Cross-module events via `window.dispatchEvent()`
6. Dashboard → `rebuild_dashboard_financial_stats()` RPC writes `dashboard_stats`; UI reads it

---

## UI Conventions

**Status colors**: Activa=green, Suspendida=yellow, Inactiva=gray, Vencida=red
**Expiration warnings**: <1d=red-600, <3d=red-500, <7d=yellow-500, 100+d=green
**Icons (lucide-react)**: Edit=`Pencil`, Delete=`Trash2`, WhatsApp=`MessageCircle` (green-600), Add=`Plus`, Back=`ArrowLeft`
**Metrics grid**: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4` (6 cards: add `xl:grid-cols-6`)
**Font**: Inter only. NEVER `font-mono`.

---

## Common Commands

```bash
npm run dev          # Dev server
npm run build        # Production build
npm run lint         # ESLint
npm test             # Vitest

# Supabase (CLI)
supabase migration new <name>
supabase db push                     # apply local migrations to linked project
supabase gen types typescript ...    # regenerate src/lib/supabase/database.types.ts
supabase db lint                     # advisor / linter

# One-shot data fixes against the production dataset (NOT migrations):
psql "$SUPABASE_DB_URL" -f scripts/data-fixes/<file>.sql

# Legacy Firebase audit/cleanup (uses firebase-admin)
npm run legacy:audit
npm run legacy:cleanup:dry
npm run legacy:cleanup
```

### Required env vars (`.env.local`)
```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # server-side only, never exposed to client
```

---

## Known Issues / Open Deuda

1. `compat.ts` (~1000 LOC) is a temporary Firestore-shaped shim — should be replaced gradually by domain repositories in `src/lib/supabase/queries.ts`.
2. `*SyncService` files (`servicioSyncService`, `metodoPagoSyncService`, `usuarioMetodoPagoSyncService`) still expose `resync*` helpers that are mostly no-ops in V2; they remain for backwards compatibility but can be slimmed down further.
3. Some hooks/stores still carry comments referring to "Firestore" / "Firebase reads" — cosmetic, pending sweep.
4. Per-record data fixes against the production Firebase dataset live in `scripts/data-fixes/` and must be applied manually after a fresh import.
5. `VentaDoc.pagos` — @deprecated embedded array; use `pagos_venta` table.

---

## Documentation Index

### Reference Docs (`docs/`)
| Topic | File |
|-------|------|
| Supabase migration plan | `docs/plans/supabase normalized migration.md` |
| V2 hardening | `docs/plans/2026-05-05-supabase-v2-hardening.md` |
| Pagination & cache | `docs/PAGINATION_AND_CACHE_PATTERN.md` |
| Currency conversion design | `docs/plans/2026-02-12-currency-conversion-design.md` |
| Currency setup | `docs/CURRENCY_CONVERSION_SETUP.md` |
| React optimizations | `docs/PERFORMANCE_OPTIMIZATIONS.md` |
| Architecture | `docs/ARCHITECTURE.md` |
| Denormalization process | `docs/DENORMALIZATION_ANALYSIS_PROCESS.md` |
| Developer guide | `docs/DEVELOPER_GUIDE.md` |
| Quick start | `docs/QUICK_START.md` |
| C4 diagrams | `docs/C4_DIAGRAMS.md` |

### Design Plans (`docs/plans/`)
| Plan | File |
|------|------|
| Currency conversion | `docs/plans/2026-02-12-currency-conversion-design.md` |
| Notifications v2.1 | `docs/plans/2026-02-12-notificaciones-persistentes-design-v2.1.md` |
| Activity log changes | `docs/plans/2026-02-13-activity-log-detailed-changes.md` |
| Dashboard implementation | `docs/plans/2026-02-13-dashboard-implementation-design.md` |
| Dashboard metrics | `docs/plans/2026-02-22-dashboard-metrics-optimization-design.md` |
| Netflix Reposo | `docs/plans/2026-03-05-netflix-reposo-design.md` |
| Supabase migration | `docs/plans/supabase normalized migration.md` |
| Supabase V2 hardening | `docs/plans/2026-05-05-supabase-v2-hardening.md` |

### Historical Designs (`docs/archive/`)
Designs for fully-implemented features.

| Plan | File |
|------|------|
| Dashboard year filter | `docs/archive/2026-02-21-configuracion-modal-dashboard-year-filter.md` |
| HCI analysis | `docs/archive/2026-02-28-hci-analysis.md` |
| Servicio edit venta | `docs/archive/2026-03-15-servicio-edit-venta-design.md` |
| Servicio view button | `docs/archive/2026-03-15-servicio-view-button-design.md` |
| Usuario método pago | `docs/archive/2026-03-15-usuario-metodo-pago-design.md` |
| Gastos | `docs/archive/2026-03-18-gastos-design.md` |
| Pronóstico paginación | `docs/archive/2026-04-03-pronostico-financiero-paginacion-design.md` |

### Scripts (`scripts/`)
| Path | Purpose |
|------|---------|
| `scripts/README.md` | Scripts overview |
| `scripts/migrate-to-supabase.ts` | One-shot Firebase → Supabase data importer |
| `scripts/sync-supabase-auth-users.ts` | Provision auth users from `usuarios` |
| `scripts/validate-supabase-migration.ts` | Post-import validation |
| `scripts/audit-firebase-legacy.ts` | Audit residual Firestore data |
| `scripts/cleanup-firebase-legacy.ts` | Delete migrated Firestore docs |
| `scripts/data-fixes/` | Per-record SQL fixes against the production dataset |
| `scripts/firebase-monitor.js` | Legacy Firestore reads monitor (no longer relevant) |

---

**Last Updated:** May 2026 | **Version:** 3.0.0 (Supabase V2)
