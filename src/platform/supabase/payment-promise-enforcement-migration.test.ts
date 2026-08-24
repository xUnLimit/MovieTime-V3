import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260823173000_enforce_venta_payment_promise.sql',
);

const correctionMigrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260824130000_allow_any_venta_payment_promise_date.sql',
);

describe('venta payment promise database enforcement', () => {
  it('rejects non-future dates using the Panama calendar day', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain("AT TIME ZONE 'America/Panama'");
    expect(sql).toMatch(/NEW\.fecha_prometida_pago\s*<=/);
    expect(sql).toContain('La fecha prometida de pago debe ser posterior a hoy');
  });

  it('atomically marks a newly saved promise as read without changing removals', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toMatch(/IF NEW\.fecha_prometida_pago IS NOT NULL THEN/);
    expect(sql).toContain('NEW.leida := TRUE');
    expect(sql).toContain('BEFORE UPDATE OF fecha_prometida_pago');
  });

  it('replaces the database rule so any payment promise date is accepted', () => {
    const sql = existsSync(correctionMigrationPath)
      ? readFileSync(correctionMigrationPath, 'utf8')
      : '';

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.enforce_venta_payment_promise()');
    expect(sql).not.toMatch(/NEW\.fecha_prometida_pago\s*(?:<|>)/);
    expect(sql).not.toContain('RAISE EXCEPTION');
    expect(sql).toContain('NEW.leida := TRUE');
    expect(sql).toContain('NEW.read_at := COALESCE(NEW.read_at, CURRENT_TIMESTAMP)');
  });
});
