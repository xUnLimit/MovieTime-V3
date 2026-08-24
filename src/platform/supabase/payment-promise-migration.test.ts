import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260823170000_venta_payment_promise.sql',
);

describe('venta payment promise migration', () => {
  it('adds a venta-only promise date and exposes it through the venta view', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('ADD COLUMN IF NOT EXISTS fecha_prometida_pago DATE');
    expect(sql).toContain("fecha_prometida_pago IS NULL OR entidad = 'venta'");
    expect(sql).toContain('n.fecha_prometida_pago');
    expect(sql).toContain('CREATE OR REPLACE VIEW public.v_notificaciones_venta');
  });

  it('allows authenticated promise updates without widening other base writes', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain(
      'GRANT UPDATE (leida, resaltada, read_at, dismissed_at, fecha_prometida_pago, updated_at)',
    );
    expect(sql).toContain('REVOKE UPDATE ON TABLE public.notificaciones FROM authenticated');
  });

  it('keeps aggregate sync state by leaving the promise column outside conflict updates', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).not.toMatch(/fecha_prometida_pago\s*=\s*EXCLUDED\.fecha_prometida_pago/i);
  });
});
