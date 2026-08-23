import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260823150000_atomic_notification_aggregate.sql',
);
const adapterPath = join(process.cwd(), 'src', 'platform', 'supabase', 'notifications-rpc-adapter.ts');
const databaseTypesPath = join(process.cwd(), 'src', 'platform', 'supabase', 'database.types.ts');

describe('atomic notification aggregate migration', () => {
  it('repairs each detail type before enabling the integrity guard', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('INSERT INTO public.notificaciones_venta');
    expect(sql).toContain('INSERT INTO public.notificaciones_servicio');
    expect(sql).toContain('INSERT INTO public.notificaciones_reposo');
    expect(sql).toContain('DELETE FROM public.notificaciones AS n');
    expect(sql).toContain('Notification integrity repair failed');
  });

  it('uses one idempotent transactional RPC for base and detail writes', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.upsert_notification_aggregate');
    expect(sql).toContain('ON CONFLICT (dedupe_key)');
    expect(sql).toContain('ON CONFLICT (notificacion_id)');
    expect(sql).toContain('DEFERRABLE INITIALLY DEFERRED');
    expect(sql).toContain('OLD.notificacion_id IS DISTINCT FROM NEW.notificacion_id');
  });

  it('forces authenticated clients through the RPC boundary', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain(
      'REVOKE INSERT ON TABLE public.notificaciones FROM authenticated',
    );
    expect(sql).toContain(
      'REVOKE UPDATE ON TABLE public.notificaciones FROM authenticated',
    );
    expect(sql).toContain(
      'GRANT UPDATE (leida, resaltada, read_at, dismissed_at, updated_at) ON TABLE public.notificaciones TO authenticated',
    );
    expect(sql).toContain(
      'REVOKE INSERT, UPDATE, DELETE ON TABLE public.notificaciones_venta FROM authenticated',
    );
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.upsert_notification_aggregate');
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.upsert_notification_aggregate(jsonb, jsonb, boolean) TO authenticated, service_role',
    );
  });

  it('keeps the adapter coupled to the generated Supabase RPC contract', () => {
    const adapter = readFileSync(adapterPath, 'utf8');
    const databaseTypes = readFileSync(databaseTypesPath, 'utf8');

    expect(databaseTypes).toContain('upsert_notification_aggregate:');
    expect(adapter).not.toContain('typedRpcClient');
    expect(adapter).toContain("supabase.rpc('upsert_notification_aggregate'");
  });
});
