import { describe, expect, it } from 'vitest';

import { createIdempotencyKey, withIdempotencyKey } from './idempotency';

describe('idempotency helpers', () => {
  it('keeps an existing idempotency key', () => {
    const payload = withIdempotencyKey({
      p_venta_id: 'venta-1',
      p_idempotency_key: '00000000-0000-4000-8000-000000000001',
    });

    expect(payload.p_idempotency_key).toBe('00000000-0000-4000-8000-000000000001');
  });

  it('adds an idempotency key when missing', () => {
    const payload = withIdempotencyKey({ p_venta_id: 'venta-1' });

    expect(payload.p_idempotency_key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('generates uuid-shaped keys', () => {
    expect(createIdempotencyKey()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });
});
