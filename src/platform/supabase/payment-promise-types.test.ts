import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('venta payment promise generated database types', () => {
  it('includes the promise date on the base table and venta notification view', () => {
    const types = readFileSync(
      join(process.cwd(), 'src', 'platform', 'supabase', 'database.types.ts'),
      'utf8',
    );

    expect(types).toContain('fecha_prometida_pago: string | null');
    expect(types).toContain('fecha_prometida_pago?: string | null');
  });
});
