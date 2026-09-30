# MovieTime PTY Context

## Domain

- Tercero: person or business managed by the app. A tercero can be a cliente or revendedor.
- Usuario auth: authenticated application profile used for login, active/admin checks and server-side authorization. The physical table can be named `usuarios`; do not use this term for the commercial tercero domain.
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
- Corte: ending a venta early, optionally inactivating its servicio, usually together with a refund.

## Messaging (WhatsApp)

- Plantilla (template): message text edited in `/editor-mensajes`, keyed by tipo (`dia_pago`, `cancelacion`, `renovacion`, `suscripcion`, `actualizacion_credenciales`, `transferencia_servicio`, `datos_pago`, `despedida`). It can be linked to an approved Meta template so it can be sent outside the 24h window.
- Plantilla Meta: template approved by Meta for the WhatsApp Cloud API. The approved list lives in `docs/whatsapp/plantillas-meta-v2.md`.
- Aviso: expiration or cancellation message sent to a cliente for a venta, manually from `/notificaciones` or automatically by cron. Avisos are deduplicated per venta and event.
- Envio automatico: hourly cron that sends payment-day avisos. It is controlled from Configuracion by an on/off switch, the send hour (Panama time) and a daily cap.
- Boton de respuesta: quick reply on an aviso that triggers an action: `RENOVAR` sends payment details, `NO_CONTINUAR` records that the cliente will not renew, `DATOS` sends access credentials.
- Chat: WhatsApp conversation shown in `/chats`, stored from the Meta webhook together with delivery statuses and media.

## Payments detection (Yappy)

- Aviso Yappy: payment notification email read by IMAP and shown in `/pagos-yappy`. It never creates `pagos_venta` by itself. An operator registers the payment through the normal renewal flow and then reconciles or discards the aviso.

## Architecture

- `src/app` owns Next.js App Router routes, layouts, metadata and API route handlers.
- `src/components` owns UI modules and shared interface pieces.
- `src/store` owns Zustand UI state and optimistic mutation state. It must not own transactional domain invariants.
- `src/application/use-cases` owns composed business flows. Ventas and servicios are split by queries, writes, payments/refunds and shared helpers.
- `src/modules/payments` owns payment factories, currency conversion and payment calculations. New business code should import payment/currency behavior from this module.
- `src/modules/notifications` owns notification calculation, cleanup, sync orchestration and push delivery helpers. Notification sync imports must target this module directly.
- `src/modules/dashboard-read-models` and `src/modules/forecasting` own dashboard/forecast reads and sync. New dashboard code should not add client-side metric mutation APIs.
- `src/platform/events` owns typed client business events through `StoreEventBus`.
- `src/platform/supabase` owns Supabase clients, repositories, mappers and generated database types.
- `src/modules/messaging` owns template tipos, aviso storage, reply buttons and Meta template mapping. `src/modules/whatsapp` owns the Cloud API client, webhook parsing, outbound messages and media.
- `src/modules/yappy` owns parsing of Yappy payment emails.
- `src/modules/services` contains operational services that still have their own domain behavior. Do not add dashboard metric mutation or notification sync interfaces here when a deep module already exists.
- `supabase/migrations` owns schema, views, RPC functions, triggers and RLS.
- `scripts` owns maintenance and validation commands.

Supabase/Postgres is the source of truth. Derived metrics are maintained by SQL views, RPC functions, triggers or dedicated dashboard services. Client-side repository functions must not expose fake metric mutation APIs.

Critical RPCs that create ventas, servicios, payments or refunds must be called through typed adapters and must carry idempotency keys.

## Validation

The definition of done and the required commands are in `AGENTS.md`.
