# Gastos Module Design

Date: 2026-03-18
Status: Approved for implementation planning

## Summary

Add a new dashboard module called `Gastos` to register manual business expenses outside the existing `servicios` payment flow.

The module will:
- manage its own catalog of `tipos de gasto`
- let users create, edit, and delete manual expense records
- update dashboard expense aggregates incrementally
- live under the `OTROS` section in the sidebar, above `Netflix Reposo`

The module will not:
- support recurring expenses in this phase
- support multi-currency in this phase
- affect category profitability widgets
- affect expected monthly forecast widgets

## Why this module is separate

`Servicios` already models provider costs and renewals. The new requirement is for manual operational expenses that do not belong to that domain. Mixing both would increase coupling and make dashboard behavior harder to reason about.

The new module should be independent but still feed the shared dashboard expense totals.

## Naming

Approved product name:
- `Gastos`

Supporting names:
- `Tipos de gasto`
- `Gasto`

## Chosen approach

Chosen approach: separate catalog + manual expense records.

Options considered:
1. Fixed list of types + expense records
2. Managed catalog + expense records
3. Immutable accounting ledger

Option 2 was selected because it matches the current architecture, keeps the UI simple, and avoids overengineering.

## Functional requirements

Validated requirements:
- each expense belongs to one `tipo de gasto`
- users can create expense types from the system
- expenses are registered manually when they happen
- expenses use USD only in this phase
- each expense may include free-form detail text
- users can edit and delete expense records
- expenses must be added to total dashboard expenses
- the module should appear in `OTROS`, above `Netflix Reposo`

## Data model

### Collection: `tiposGasto`

Fields:
- `nombre`
- `descripcion?`
- `activo`
- `createdAt`
- `updatedAt`

Rules:
- types should be inactivated instead of hard-deleted once they have linked expense records
- inactive types cannot be used for new records

### Collection: `gastos`

Fields:
- `tipoGastoId`
- `tipoGastoNombre` (denormalized)
- `fecha`
- `monto`
- `detalle`
- `createdAt`
- `updatedAt`

Rules:
- `tipoGastoId`, `fecha`, and `monto` are required
- `monto` must be greater than zero
- `detalle` is optional

## UX and navigation

### Sidebar placement

Add `Gastos` under the `OTROS` section in the sidebar, above `Netflix Reposo`.

### Route structure

Planned route:
- `src/app/(dashboard)/gastos/page.tsx`

### Planned files

Types:
- `src/types/gastos.ts`

Stores:
- `src/store/gastosStore.ts`
- `src/store/tiposGastoStore.ts`

Components:
- `src/components/gastos/GastosTable.tsx`
- `src/components/gastos/GastoForm.tsx`
- `src/components/gastos/GastosMetrics.tsx`
- `src/components/gastos/TipoGastoDialog.tsx`

### Screen behavior

Main `Gastos` page:
- simple metrics row
- filters by type and date range
- expense table
- create expense action
- manage `tipos de gasto` from the same screen

`Tipos de gasto` should not get a separate sidebar entry in this phase.

## Dashboard integration

Dashboard impact must be incremental, not rebuild-based.

When creating a gasto:
- add its amount to total expense aggregates
- add its amount to the month of `fecha`
- add its amount to the day of `fecha`

When editing a gasto:
- if only `detalle` or the displayed type name changes, no dashboard total change is needed
- if `monto` changes, adjust by the delta
- if `fecha` changes across periods, revert the old period and apply the new one

When deleting a gasto:
- revert its contribution from expense aggregates

This is required because the current dashboard reads from time-based aggregates, not only a single total.

Affected dashboard areas:
- total expenses
- total profit
- ingresos vs gastos monthly chart
- current-month daily gastos data

Not affected in this phase:
- expected monthly expense forecast
- category profitability widgets

## Logging

Each create, edit, and delete action should produce an activity log entry using entity `gasto`.

## Validation and error handling

Required validation:
- type required
- date required
- amount required and greater than zero
- inactive types cannot be selected

UX expectations:
- success and error toasts
- delete confirmation dialog
- no partial-success behavior where the gasto saves but dashboard sync is skipped silently

## Testing

Minimum recommended coverage:
- `gastosStore` create/edit/delete behavior
- dashboard aggregate adjustment on create
- dashboard aggregate adjustment when moving a gasto across months
- validation against inactive types
- preventing deletion of types that already have linked gastos

## Notes for implementation

Existing code paths to align with:
- Firestore collection constants already include `GASTOS`
- dashboard aggregates are handled by `dashboardStatsService`
- activity log already supports entity `gasto`

One implementation detail will likely be needed:
- add a dedicated helper for historical expense adjustments, or extend the current dashboard stats service to support reverting and reapplying gasto records safely
