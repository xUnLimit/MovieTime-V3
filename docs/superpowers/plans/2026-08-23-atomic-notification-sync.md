# Atomic Notification Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make notification aggregate writes atomic and idempotent, repair all existing incomplete notifications, and verify missing sales are visible again.

**Architecture:** A security-hardened PostgreSQL RPC owns base/detail upserts in one transaction. Deferred constraint triggers enforce the polymorphic aggregate invariant, while the TypeScript repository routes full notification writes through a typed RPC adapter and retains base-only state updates.

**Tech Stack:** PostgreSQL/Supabase migrations and RLS, TypeScript, Supabase JS, Vitest, Next.js.

---

### Task 1: Add repository/RPC regression tests

**Files:**
- Create: `src/platform/supabase/notifications-rpc-adapter.test.ts`
- Create: `src/platform/supabase/notification-atomic-migration.test.ts`
- Modify: `src/platform/supabase/notifications-repository.ts`

- [ ] **Step 1: Write the failing adapter test**

Mock `supabase.rpc`, pass explicit base/detail payloads, and assert exactly one
`upsert_notification_aggregate` call returns the authoritative ID. Add an error
case asserting PostgreSQL code/detail/hint survive in the thrown error.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --run src/platform/supabase/notifications-rpc-adapter.test.ts`

Expected: FAIL because `notifications-rpc-adapter.ts` does not exist.

- [ ] **Step 3: Write the failing repository contract test**

Assert full create/update payloads use the aggregate RPC while partial
`{ leida, resaltada }` updates continue using the base table update path.

- [ ] **Step 4: Run the repository test and verify RED**

Run: `npm test -- --run src/platform/supabase/notifications-repository.test.ts`

Expected: FAIL because the repository still performs separate base/detail writes.

### Task 2: Add the atomic database migration

**Files:**
- Create: `supabase/migrations/20260823150000_atomic_notification_aggregate.sql`
- Create: `src/platform/supabase/notification-atomic-migration.test.ts`

- [ ] **Step 1: Write the failing migration contract test**

Read the migration text and assert it contains:

```ts
expect(sql).toContain('CREATE OR REPLACE FUNCTION public.upsert_notification_aggregate');
expect(sql).toContain('ON CONFLICT (dedupe_key)');
expect(sql).toContain('DEFERRABLE INITIALLY DEFERRED');
expect(sql).toContain('REVOKE INSERT ON TABLE public.notificaciones FROM authenticated');
```

- [ ] **Step 2: Run the migration contract test and verify RED**

Run: `npm test -- --run src/platform/supabase/notification-atomic-migration.test.ts`

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement repair, RPC, constraints, and grants**

The migration must:

```sql
INSERT INTO public.notificaciones_venta (...)
SELECT ... FROM public.notificaciones n
JOIN public.v_ventas_full v ON n.dedupe_key = 'venta:' || v.id
WHERE NOT EXISTS (...);

CREATE OR REPLACE FUNCTION public.upsert_notification_aggregate(
  p_base jsonb,
  p_detail jsonb
) RETURNS text ...;

REVOKE INSERT ON TABLE public.notificaciones FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.notificaciones_venta FROM authenticated;
```

Repeat the repair and permission boundary for service/rest details, add deferred
constraint triggers for base and detail changes, revoke RPC execution from public
and anon, and grant it to authenticated/service_role.

- [ ] **Step 4: Run migration validation and contract test**

Run: `npm run migrate:validate`

Run: `npm test -- --run src/platform/supabase/notification-atomic-migration.test.ts`

Expected: both PASS.

### Task 3: Route full writes through a typed RPC adapter

**Files:**
- Create: `src/platform/supabase/notifications-rpc-adapter.ts`
- Modify: `src/platform/supabase/notifications-repository.ts`
- Modify: `src/platform/supabase/database.types.ts`

- [ ] **Step 1: Implement explicit RPC payload types and diagnostics**

Expose:

```ts
export type NotificationAggregateRpcPayload = {
  p_base: Json;
  p_detail: Json;
};

export async function upsertNotificationAggregateRpc(
  payload: NotificationAggregateRpcPayload
): Promise<string>;
```

Use `typedRpcClient`, `assertOnlineMutation`, and `assertRpcStringId`. Preserve
`code`, `details`, and `hint` in the thrown error message.

- [ ] **Step 2: Run adapter tests and verify GREEN**

Run: `npm test -- --run src/platform/supabase/notifications-rpc-adapter.test.ts`

Expected: PASS.

- [ ] **Step 3: Replace split create/full update writes**

Map the domain payload into database base/detail objects, call the RPC once, and
remove direct detail upserts. Keep base-only updates for read/highlight mutations.

- [ ] **Step 4: Run repository and notification behavior tests**

Run: `npm test -- --run src/platform/supabase/notifications-repository.test.ts src/modules/notifications/notification-sync-behavior.test.ts src/modules/notifications/notification-sync-modules.test.ts`

Expected: PASS.

### Task 4: Verify locally and apply to linked Supabase

**Files:**
- Modify mechanically after deployment: `src/platform/supabase/database.types.ts`

- [ ] **Step 1: Run the complete local verification checklist**

Run: `npm run lint`

Run: `npm test -- --run`

Run: `npm run test:coverage`

Run: `npm run build`

Run: `npm run migrate:validate`

Expected: all commands exit 0.

- [ ] **Step 2: Preview and apply the linked migration**

Run: `npx supabase db push --dry-run --linked`

Run: `npx supabase db push --yes --linked`

Expected: only `20260823150000_atomic_notification_aggregate.sql` is applied.

- [ ] **Step 3: Regenerate database types**

Run: `npx supabase gen types typescript --linked`

Replace `src/platform/supabase/database.types.ts` with the generated output and
rerun TypeScript/build verification.

- [ ] **Step 4: Force sync and verify repaired data**

Run the updated notification synchronization against the linked project, then
query counts through the service-role diagnostic client.

Expected:

```json
{
  "orphanTotal": 0,
  "mismatchedTotal": 0,
  "missingLoggedSaleIds": 0
}
```

- [ ] **Step 5: Review the final diff**

Run: `git diff --check`

Run: `git status --short`

Confirm no unrelated user files changed and do not commit or push without an
explicit request.
