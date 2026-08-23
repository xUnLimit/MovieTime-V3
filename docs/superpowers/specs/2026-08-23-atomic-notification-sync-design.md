# Atomic Notification Sync Design

**Date:** 2026-08-23  
**Status:** Approved for implementation

## Problem statement

Notification creation currently spans two independent HTTP/database transactions:

1. `notificaciones` receives the base row and commits it.
2. One of `notificaciones_venta`, `notificaciones_servicio`, or
   `notificaciones_reposo` receives the detail row.

If step 2 fails, step 1 cannot be rolled back. The read views use inner joins, so
the incomplete base row disappears from `/notificaciones`. A later sync sees no
view row, attempts another base insert with the same deterministic `dedupe_key`,
and PostgreSQL rejects it. The retry loop therefore cannot heal the data.

The linked database confirms this failure mode. It contains 101 base rows, 88
detail rows, and 13 orphan base rows. All 13 orphans were created by one bulk sync
between 2026-08-17 15:17:55 UTC and 15:17:58 UTC.

The original detail error was not stored durably. Possible triggers include a
foreign-key violation, schema-cache/schema-contract drift, or a network failure.
The exact trigger is no longer recoverable, but the split transaction is the root
cause that allowed that transient error to become persistent corruption.

## Goals

- Make base and detail writes one PostgreSQL transaction.
- Make notification creation idempotent and safe under concurrent syncs.
- Repair every existing orphan without losing read/highlight state.
- Enforce the aggregate invariant in PostgreSQL, independent of client behavior.
- Prevent future application code from bypassing the atomic write path.
- Restore all eligible sales and services to `/notificaciones`.
- Preserve current notification views and public TypeScript interfaces.

## Non-goals

- Redesign the `/notificaciones` user interface.
- Replace the normalized base/detail schema with a single wide table.
- Change notification timing, priority, cleanup, or renewal business rules.
- Preserve an orphan whose source sale/service no longer exists; such a base row
  is invalid and will be removed during repair.

## Chosen architecture

### Transactional upsert RPC

Add one database RPC for notification aggregate writes. It will:

1. Reject unauthenticated calls.
2. Validate that `entidad` is `venta`, `servicio`, or `reposo` and that the
   deterministic key matches the referenced entity.
3. Insert the base row with `ON CONFLICT (dedupe_key) DO UPDATE` and return the
   authoritative base ID.
4. Preserve `leida`, `resaltada`, `read_at`, and `dismissed_at` when the base row
   already exists.
5. Upsert exactly one matching detail row using the authoritative base ID.
6. Remove an incompatible detail only if repairing a pre-existing corrupted
   aggregate.
7. Let any validation, FK, or detail error abort the complete transaction.

PostgreSQL functions execute within the caller's statement transaction. A detail
failure therefore leaves neither a new base row nor a partial update.

### Database-enforced invariant

Add deferred constraint triggers that validate the final transaction state:

- A `venta` base has exactly one `notificaciones_venta` detail.
- A `servicio` base has exactly one `notificaciones_servicio` detail.
- A `reposo` base has exactly one `notificaciones_reposo` detail.
- No base has details belonging to another entity type.

The checks run at transaction completion so the RPC may insert the base before
the detail inside the same transaction. Corresponding detail-table triggers also
prevent a later direct detail deletion or identity change from creating an orphan.
Deleting the base remains valid because cascading detail deletion observes that
the parent no longer exists.

### Permission boundary

The RPC will be `SECURITY DEFINER`, use a fixed safe `search_path`, check
`auth.uid()`, and be executable only by `authenticated` and `service_role`.

Direct `INSERT` on `notificaciones` and direct `INSERT`, `UPDATE`, and `DELETE` on
the three detail tables will be revoked from `authenticated`. Base updates for
read/highlight state and base deletes for existing cleanup behavior remain
available under the current RLS policies. This makes the atomic path mandatory
for application notification aggregate writes.

### Client adapter

`notifications-repository.ts` will map domain payloads into explicit base and
detail RPC arguments and call the RPC for create/full synchronization updates.
Partial base-only operations such as marking a notification read remain normal
base updates.

The notification write adapter will use the generated Supabase RPC type instead
of `as never`. Database types will be regenerated or updated from the applied
schema so schema drift becomes a compile-time failure rather than a hidden runtime
error.

## Existing-data repair

The migration will repair all existing orphans before enabling the invariant:

- `venta` details are reconstructed from `v_ventas_full` and the latest sale
  period fields.
- `servicio` details are reconstructed from `v_servicios_full` and the latest
  service period fields.
- `reposo` details are reconstructed from the live service row.
- Existing base IDs, `dedupe_key`, timestamps, read state, and highlight state are
  preserved.
- Orphans whose source entity no longer exists are deleted because they cannot
  produce a valid notification.

After repair, an integrity query must return zero missing, mismatched, or duplicate
details. The application will then force a normal bulk sync to refresh calculated
titles, priorities, remaining days, and snapshots using the new atomic RPC.

## Failure handling and observability

- The RPC returns the authoritative notification ID.
- PostgreSQL error code, message, detail, and hint are retained by the repository
  error instead of reducing the failure to message text alone.
- Bulk sync continues isolating per-entity failures, but a failed RPC can no
  longer leave partial data.
- Partial sync still resets the sync marker for retry, while a dedupe conflict is
  handled as a normal idempotent upsert rather than an error.
- Verification reports base count, detail count, and integrity violations without
  exposing customer data.

## Test strategy

### Migration/static contract tests

- The RPC uses `ON CONFLICT (dedupe_key)` and writes the matching detail.
- Creation privileges are revoked from the authenticated client role.
- Execute privileges are limited to authenticated/service roles.
- Deferred constraint triggers cover base and all detail tables.
- Repair SQL covers sale, service, and rest entities.

### Repository tests

- Creating a sale notification invokes the atomic RPC once with matching base and
  detail data.
- Service and rest payloads map to their correct detail shape.
- An existing/orphan dedupe key returns its authoritative ID without a second base
  insert.
- RPC errors preserve structured database diagnostics.
- Base-only read/highlight updates do not invoke the aggregate RPC.

### Behavioral and integration verification

- Two concurrent calls with the same dedupe key produce one complete aggregate.
- A forced detail failure rolls back the base write.
- Direct base-only creation is rejected.
- Direct detail deletion cannot commit while its base remains.
- Existing notification sync unit tests continue to pass.
- The linked database reports zero integrity violations after migration and sync.
- Each previously missing eligible sale ID is present in
  `v_notificaciones_venta` and `/notificaciones` reads.

## Rollout

1. Add failing regression tests.
2. Add and validate the migration and RPC.
3. Update the repository adapter and generated database types.
4. Run targeted tests, the full test suite, lint, migration validation, coverage,
   and production build.
5. Apply the migration to the linked Supabase project.
6. Run a forced notification sync through the updated code.
7. Query integrity counts and the formerly missing sale/service IDs.
8. Verify `/notificaciones` against the linked project.

## Acceptance criteria

- The 13 existing orphan base rows are repaired or removed only when their source
  entity is absent.
- Every eligible missing sale appears through `v_notificaciones_venta` and the
  application read path.
- No application-accessible path can commit a base notification without exactly
  one matching detail.
- Concurrent syncs do not emit duplicate-key errors.
- A detail failure leaves no base row behind.
- Database types match the deployed RPC/schema, and the notification aggregate
  write path contains no `as never` escape hatch.
- All required project verification commands pass before the linked migration is
  applied.
