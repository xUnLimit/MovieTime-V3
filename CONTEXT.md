# MovieTime PTY Context

## Domain

- Tercero: person or business managed by the app. A tercero can be a cliente or revendedor.
- Categoria: commercial grouping used to organize servicios, ventas, plans, counters, income and expenses.
- Servicio: provider account or subscription inventory that can have profiles, periods, payments and renewal forecasts.
- Venta: customer subscription assigned to a servicio/profile and tracked through venta periods and payments.
- Pago de venta: money received for a venta period. Refunds are represented as signed payment movement.
- Pago de servicio: expense paid for a servicio period.
- Plan: sellable offering inside a categoria. Ventas must keep plan snapshots for historical accuracy.
- Notificacion: operational reminder generated from ventas and servicios close to expiration.
- Reposo: temporary paused state for a servicio.
- Pronostico financiero: forecast read model used by the dashboard for upcoming income and expenses.
- Metodo de pago: payment method metadata copied into venta and servicio payments for auditability.
- Copia offline: browser-side read fallback for PWA usage. Mutations require online mode.
- Push ejecutiva: scheduled push summary for operational metrics.
- Feature flag: runtime rollout switch stored in Supabase and read through React Query.
- Store event: typed client-side business event used to invalidate queries/stores without DOM/localStorage coupling.
- Idempotency key: client-generated UUID passed to critical RPCs so network retries do not duplicate ventas, servicios, pagos or refunds.

## Architecture

- `src/app` owns Next.js App Router routes, layouts, metadata and API route handlers.
- `src/components` owns UI modules and shared interface pieces.
- `src/store` owns Zustand UI state and optimistic mutation state. It must not own transactional domain invariants.
- `src/lib/use-cases` owns composed business flows. Ventas and servicios are split by queries, writes, payments/refunds and shared helpers.
- `src/lib/payments` owns payment factories, currency conversion and payment calculations. New business code should import payment/currency behavior from this module.
- `src/lib/notifications` owns notification calculation, cleanup, sync orchestration and push delivery helpers. Notification sync imports must target this module directly.
- `src/lib/dashboard-read-models` and `src/lib/forecasting` own dashboard/forecast reads and sync. New dashboard code should not add client-side metric mutation APIs.
- `src/lib/events` owns typed client business events through `StoreEventBus`.
- `src/lib/supabase` owns Supabase clients, repositories, mappers and generated database types.
- `src/lib/services` contains operational services that still have their own domain behavior. Do not add dashboard metric mutation or notification sync interfaces here when a deep module already exists.
- `supabase/migrations` owns schema, views, RPC functions, triggers and RLS.
- `scripts` owns maintenance and validation commands.

Supabase/Postgres is the source of truth. Derived metrics are maintained by SQL views, RPC functions, triggers or dedicated dashboard services. Client-side repository functions must not expose fake metric mutation APIs.

Critical RPCs that create ventas, servicios, payments or refunds must be called through typed adapters and must carry idempotency keys.

## Validation

Use these commands before merging meaningful changes:

```bash
npm run lint
npm test -- --run
npm run build
npm run migrate:validate
```
