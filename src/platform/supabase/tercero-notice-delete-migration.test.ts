import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const sql = readFileSync(join(process.cwd(), 'supabase/migrations',
  '20261006020000_whatsapp_notices_tercero_delete_cascade.sql'), 'utf8');

describe('tercero notice deletion migration', () => {
  it('replaces and validates the notice FK atomically', () => {
    expect(sql).toMatch(/BEGIN;[\s\S]*DROP CONSTRAINT whatsapp_notices_tercero_id_fkey[\s\S]*ADD CONSTRAINT whatsapp_notices_tercero_id_fkey[\s\S]*COMMIT;/);
    expect(sql).toMatch(/FOREIGN KEY \(tercero_id\) REFERENCES public\.terceros\(id\)\s+ON DELETE CASCADE NOT VALID/);
    expect(sql).toContain('VALIDATE CONSTRAINT whatsapp_notices_tercero_id_fkey');
  });

  it('keeps other dependencies and authorization unchanged', () => {
    expect(sql).not.toMatch(/ALTER TABLE public\.(pedidos|ventas|pagos_venta)/);
    expect(sql).not.toMatch(/GRANT|REVOKE|DISABLE ROW LEVEL SECURITY/);
    expect(sql).not.toMatch(/DROP (TABLE|COLUMN|SCHEMA)|TRUNCATE|DELETE FROM/);
  });
});
